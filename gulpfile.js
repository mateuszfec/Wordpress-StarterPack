'use strict';

// GULP OPTIONS:
// --prod      | minify and clean all code
// --save      | save all temporary (build) files in assets directory
// --nostrict  | no-strict mode for JavaScript code
// --sync      | sync browser by Browsersync | Optional: --sync=http://your-proxy-to-domain.dev/
// --port      | custom port for Browsersync | Default: 3000

// CSS preprocessors to use by Gulp
const enableSASS = true;
const enableLESS = true;
const enableStylus = true;

// JS libraries to build by Gulp
const jsLibraries = [
    './dev/js/**/*',
    '!./dev/js/*.js'
];

// Libraries
const fs = require('fs');
const del = require('del');
const log = require('fancy-log');
const chokidar = require('chokidar');
const browserSync = require('browser-sync').create();

// Gulp libraries
const gulp = require('gulp');
const gulpIf = require('gulp-if');
const babel = require('gulp-babel');
const minify = require('gulp-minify');
const concat = require('gulp-concat');
const gulpSass = require('gulp-sass');
const gulpLess = require('gulp-less');
const gulpStylus = require('gulp-stylus');
const stripDebug = require('gulp-strip-debug');
const gulpCleanCss = require('gulp-clean-css');
const gulpSourcemaps = require('gulp-sourcemaps');
const autoPrefixer = require("gulp-autoprefixer");
const lessAutoPrefixer = require('less-plugin-autoprefix'), lessAutoPrefix = new lessAutoPrefixer({browsers: ['last 5 versions']});
// const gulpHtmlMin = require('gulp-htmlmin');

// Globals
let themeVariants = {};
const isProduction = process.argv.indexOf("--prod") >= 0,
      cleanOldFiles = process.argv.indexOf("--save") < 0,
      disableStrictMode = process.argv.indexOf("--nostrict") >= 0,
      runProxy = process.argv.findIndex(value => /^--sync/.test(value)) >=0 ? process.argv.find(value => /^--sync/.test(value)) : null,
      proxyValue = runProxy !== null && runProxy.split('=')[1] ? runProxy.split('=')[1] : 'http://localhost/',
      portParameter = process.argv.findIndex(value => /^--port/.test(value)) >=0 ? process.argv.find(value => /^--port/.test(value)) : null,
      portValue = portParameter !== null && portParameter.split('=')[1] ? portParameter.split('=')[1] : 3000,
      logs = process.argv.indexOf("--log2") > 0 ? 2 : process.argv.indexOf("--log1") > 0 ? 1 : 0,
      browserSyncOptions = {
          watch: true,
          watchOptions: {
              ignoreInitial: true
          },
          files: ['assets/**/*', '**/*.php', '**/*.html']
      };

if (runProxy){
    browserSyncOptions.proxy = proxyValue;
    browserSyncOptions.port = portValue || 3000;
}

function watch(){
    const stylesWatcher = chokidar.watch([
        `./dev/less/**/*.less`, `./dev/sass/**/*.scss`, `./dev/stylus/**/*.styl`, `./dev/css/**/*.css`
    ]);
    const jsWatcher = chokidar.watch([`./dev/js/**/*.js`]);
    const assetsWatcher = chokidar.watch([`./dev/images/**/*`, `./dev/fonts/**/*`]);

    if (runProxy) browserSync.init(browserSyncOptions);

    stylesWatcher.on('ready', async () => {
        log.info("Starting - Initial build...");
        await cleanAll();
        await fonts();
        await images();
        await stylesCompiler();
        await javaScript();
        await javaScriptLibraries();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    stylesWatcher.on('change', async () => {
        log.info("Starting - Styles compiler...");
        await cleanStyles();
        await stylesCompiler();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    jsWatcher.on('change', async ()=>{
        log.info("Starting - JS compiler...");
        await cleanJavaScript();
        await javaScript();
        await javaScriptLibraries();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });

    assetsWatcher.on('change', async ()=>{
        log.info("Starting - ASSETS (images + fonts) compiler...");
        await fonts();
        await images();
        await runBrowserSync();
        log.info("Finished - Waiting for changes...");
    });
}

async function stylesCompiler() {
    if (enableSASS) prepareVariants('sass');
    if (enableLESS) prepareVariants('less');
    if (enableStylus) prepareVariants('stylus');

    if (enableSASS) await runFunctionOnVariant(sassCompiler);
    if (enableLESS) await runFunctionOnVariant(lessCompiler);
    if (enableStylus) await runFunctionOnVariant(stylusCompiler);

    await runFunctionOnVariant(concatVariantStyles);
    if (logs >= 1) log("Finished - All variants are concatenated successfully");

    if (cleanOldFiles){
        await del([`./assets/styles`]);
        if (logs >= 2) log("Finished - All temporary files are deleted successfully");
    }

    if (logs >= 1) log("Finished - All CSS files are created successfully");
}

async function runBrowserSync(){
    if (runProxy){
        return await new Promise((resolve, reject) => {
            gulp.src('*')
                .pipe(browserSync.stream())
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2) log(`Finished - Browsersync finished`);
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

async function concatVariantStyles (type, variant) {
    let finalSource = [`./dev/css/**/*.css`];

    finalSource = await concatIfExist(`./assets/styles/${variant}/${variant}-wscss-styl.css`, finalSource);
    finalSource = await concatIfExist(`./assets/styles/${variant}/${variant}-wscss-less.css`, finalSource);
    finalSource = await concatIfExist(`./assets/styles/${variant}/${variant}-wscss-sass.css`, finalSource);

    if (finalSource.length > 0){
        return await new Promise((resolve, reject) => {
            gulp.src(finalSource)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                    //.pipe(gulpIf(isProduction, mergeMediaQueries())) TODO: Merge all media-queries
                    .pipe(concat(`${variant.split("-wscss-")[0]}.css`))
                    .pipe(gulpIf(!isProduction, gulpCleanCss()))
                    .pipe(gulpIf(isProduction, gulpCleanCss({level: {1: {specialComments: 0}}})))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest(`./assets/css/`))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2) log(`Finished - All CSS for ${variant} are concatenated`);
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function sassCompiler(type, variant){
    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - SASS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    } else if (logs >= 2) log.info(` INFO - SASS compiler - variant: [${variant}]`);

    if (type === 'sass'){
        return new Promise((resolve, reject) => {
            gulp.src(`./dev/sass/${variant}.scss`)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                    .pipe(gulpSass().on('error', gulpSass.logError))
                    .pipe(autoPrefixer({
                        cascade: false,
                        remove: false
                    }))
                    .pipe(concat(`${variant}-wscss-sass.css`))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest(`./assets/styles/${variant}`))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2 && variant) {
                        log(`Finished - SASS > [${variant}] variant compiled successfully`);
                    } else if (logs >= 2) {
                        log(`Finished - SASS files are compiled successfully`);
                    }
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function lessCompiler(type, variant){
    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - LESS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    } else if (logs >= 2) log.info(` INFO - LESS compiler - variant: [${variant}]`);

    if (type === 'less'){
        return new Promise((resolve, reject) => {
            gulp.src(`./dev/less/${variant}.less`)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                    .pipe(gulpLess({
                        plugins: [lessAutoPrefix]
                    }))
                    .pipe(concat(`${variant}-wscss-less.css`))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest(`./assets/styles/${variant}`))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2 && variant) {
                        log(`Finished - LESS > [${variant}] variant compiled successfully`);
                    } else if (logs >= 2) {
                        log(`Finished - LESS files are compiled successfully`);
                    }
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function stylusCompiler(type, variant){
    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - STYLUS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    } else if (logs >= 2) log.info(` INFO - STYLUS compiler - variant: [${variant}]`);

    if (type === 'stylus'){
        return new Promise((resolve, reject) => {
            gulp.src(`./dev/stylus/${variant}.styl`)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                    .pipe(gulpStylus())
                    .pipe(concat(`${variant}-wscss-styl.css`))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest(`./assets/styles/${variant}`))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2 && variant) {
                        log(`Finished - STYLUS > [${variant}] variant compiled successfully`);
                    } else if (logs >= 2) {
                        log(`Finished - STYLUS files are compiled successfully`);
                    }
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function prepareVariants(type) {
    if (type && !(type === 'sass' || type === 'less' || type === 'stylus')) {
        if (logs >= 1) log.error(`ERROR - Schema [${type}] is not supported by Websites starter`);
        return false;
    }

    if (themeVariants.constructor === Object && !themeVariants[type]){
        let typeVariants = [];

        return fs.readdirSync(`./dev/${type}/`).forEach(file => {
            const variantName = file.substring(0, file.indexOf('.'));
            if (variantName) typeVariants.push(variantName);
            themeVariants[type] = typeVariants;
        });
    }
}

async function runFunctionOnVariant(functionName, options) {
    for(let i = 0; i < Object.keys(themeVariants).length; i++){
        const singleVariant = Object.keys(themeVariants)[i];
        for(let j = 0; j < themeVariants[Object.keys(themeVariants)[i]].length; j++){
            const singleTypeVariant = themeVariants[Object.keys(themeVariants)[i]][j];
            await functionName(singleVariant, singleTypeVariant, options);
        }
    }
}

async function concatIfExist(directory, source) {
    if (await fs.existsSync(directory)) {
        return source.concat(directory);
    } else {
        return await source;
    }
}

function javaScript() {
    return new Promise((resolve, reject) => {
        gulp.src(['./dev/js/*.js', '!./dev/js/**/*.min.js'])
            .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                .pipe(gulpIf(isProduction, stripDebug()))
                .pipe(gulpIf(!disableStrictMode, babel()))
                .pipe(minify({
                    noSource: true,
                    ext: {min: '.min.js'}
                }))
            .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
            .pipe(gulp.dest('./assets/js'))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All JS files are compiled successfully");
                resolve(true);
            });
    });
}

function javaScriptLibraries() {
    if (jsLibraries && jsLibraries.length > 0){
        return new Promise((resolve, reject) => {
            gulp.src(jsLibraries)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest('./assets/js'))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 1) log("Finished - All JS libraries files are copied successfully");
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

// function html() {
//     return gulp.src(['./*.html','./*.php'])
//         .pipe(htmlMIN({
//             collapseWhitespace: true,
//             ignoreCustomFragments: [ /<%[\s\S]*?%>/, /<\?[=|php]?[\s\S]*?\?>/ ]
//         }))
//         .pipe(gulp.dest('./assets'));
// }

function fonts(){
    return new Promise((resolve, reject) => {
        gulp.src(`./dev/fonts/**/*`)
            .pipe(gulp.dest(`./assets/fonts`))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All FONTS are copied successfully");
                resolve(true);
            });
    });
}

function images(){
    return new Promise((resolve, reject) => {
        gulp.src(`./dev/images/**/*`)
            .pipe(gulp.dest(`./assets/images`))
            .on("error", (err) => { reject(err) })
            .on("finish", ()=>{
                if (logs >= 1) log("Finished - All IMAGES are copied successfully");
                resolve(true);
            });
    });
}

function cleanAll() {
    if (cleanOldFiles){
        return del([`./assets`]);
    } else {
        return Promise.resolve();
    }
}

function cleanStyles() {
    if (cleanOldFiles){
        return del([`./assets/styles`, `./assets/css`]);
    } else {
        return Promise.resolve();
    }
}

function cleanJavaScript(){
    if (cleanOldFiles){
        return del([`./assets/js`]);
    } else {
        return Promise.resolve();
    }
}

exports.watch = watch;
exports.build = gulp.series(cleanAll, images, fonts, stylesCompiler, javaScript, javaScriptLibraries);
exports.clean = cleanAll;
exports.assets = gulp.series(images, fonts);
exports.styles = gulp.series(cleanStyles, stylesCompiler);
exports.js = gulp.series(cleanJavaScript, javaScript, javaScriptLibraries);

// exports.html = html
