'use strict';

// Libraries
const fs = require('fs');
const del = require('del');
const log = require('fancy-log');
const chokidar = require('chokidar');

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
const isProduction = !!process.argv.indexOf("--prod"),
      cleanOldFiles = !!process.argv.indexOf("--save"),
      disableStrictMode = !!process.argv.indexOf("--nostrict"),
      logs = process.argv.indexOf("--log2") > 0 ? 2 : process.argv.indexOf("--log1") > 0 ? 1 : 0;

let themeVariants = {};

function watch(){
    const stylesWatcher = chokidar.watch([
        `./dev/less/**/*.less`, `./dev/sass/**/*.scss`, `./dev/stylus/**/*.styl`, `./dev/css/**/*.css`
    ]);
    const jsWatcher = chokidar.watch([`.dev/js/**/*.js`]);
    const assetsWatcher = chokidar.watch([`./dev/images/**/*`, `./dev/fonts/**/*`]);

    stylesWatcher.on('ready', async () => {
        log.info("Starting - Initial build...");
        await cleanAll();
        await fonts();
        await images();
        await stylesCompiler();
        await javaScript();
        log.info("Finished - Waiting for changes...");
    });

    stylesWatcher.on('change', async () => {
        log.info("Starting - Styles compiler...");
        await cleanStyles();
        await stylesCompiler();
        log.info("Finished - Waiting for changes...");
    });

    jsWatcher.on('change', async ()=>{
        log.info("Starting - JS compiler...");
        await cleanJavaScript();
        await javaScript();
        log.info("Finished - Waiting for changes...");
    });

    assetsWatcher.on('change', async ()=>{
        log.info("Starting - ASSETS (images + fonts) compiler...");
        await fonts();
        await images();
        log.info("Finished - Waiting for changes...");
    });
}

async function stylesCompiler() {
    prepareVariants('sass');
    prepareVariants('less');
    prepareVariants('stylus');

    await runFunctionOnVariant(sassCompiler);
    await runFunctionOnVariant(lessCompiler);
    await runFunctionOnVariant(stylusCompiler);

    await runFunctionOnVariant(concatVariantStyles);
    if (logs >= 1) log("Finished - All variants are concatenated successfully");

    if (cleanOldFiles){
        await del([`./assets/styles`]);
        if (logs >= 2) log("Finished - All temporary files are deleted successfully");
    }

    if (logs >= 1) log("Finished - All CSS files are created successfully");
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
        gulp.src('./dev/js/*.js')
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
        gulp.src([`.dev/fonts/**/*`])
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
        gulp.src([`./dev/images/**/*`])
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
exports.build = gulp.series(cleanAll, images, fonts, stylesCompiler, javaScript);
exports.clean = cleanAll;
exports.assets = gulp.series(images, fonts);
exports.styles = gulp.series(cleanStyles, stylesCompiler);
exports.js = gulp.series(cleanJavaScript, javaScript);

// exports.html = html
