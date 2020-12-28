'use strict';

// Libraries
const fs = require('fs');
const del = require('del');
const log = require('fancy-log');

// Gulp libraries
const gulp = require('gulp');
const concat = require('gulp-concat');
const gulpIf = require('gulp-if');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpCleanCss = require('gulp-clean-css');
const gulpSass = require('gulp-sass');
const gulpLess = require('gulp-less');
const gulpStylus = require('gulp-stylus');
const gulpHtmlMin = require('gulp-htmlmin');

const LessAutoPrefix = require('less-plugin-autoprefix'), lessAutoPrefix = new LessAutoPrefix({browsers: ['last 5 versions']});


const isProduction = process.argv.indexOf("--prod") > 0;

const logs = process.argv.indexOf("--log2") > 0 ? 2 : process.argv.indexOf("--log1") > 0 ? 1 : 0;


let themeVariants = {};



async function stylesCompiler() {
    prepareVariants('sass');
    prepareVariants('less');
    prepareVariants('stylus');

    // console.log(themeVariants);

    await runFunctionOnVariant(sassCompiler);
    await runFunctionOnVariant(lessCompiler);
    await runFunctionOnVariant(stylusCompiler);


    await runFunctionOnVariant(concatVariantStyles);
    if (logs >= 1) log("Finished - All schemas are concatenated successfully");

}

async function concatVariantStyles (type, variant) {
    let finalSource = [`./assets/css/**/*.css`];

    finalSource = await concatIfExist(`./build/styles/${variant}/${variant}-wscss-sass.css`, finalSource);
    finalSource = await concatIfExist(`./build/styles/${variant}/${variant}-wscss-less.css`, finalSource);
    finalSource = await concatIfExist(`./build/styles/${variant}/${variant}-wscss-styl.css`, finalSource);

    if (finalSource.length > 0){
        return await new Promise((resolve, reject) => {
            gulp.src(finalSource)
                .pipe(gulpIf(!isProduction, gulpSourcemaps.init({loadMaps: true})))
                //.pipe(gulpif(isProduction, mergeMediaQueries())) todo: Implement media-queries merging
                .pipe(concat(`${variant.split("-wscss-")[0]}.css`))
                .pipe(gulpIf(!isProduction, gulpCleanCss()))
                .pipe(gulpIf(isProduction, gulpCleanCss({level: {1: {specialComments: 0}}})))
                .pipe(gulpIf(!isProduction, gulpSourcemaps.write('.')))
                .pipe(gulp.dest(`./build/css/`, {mode: 0o777}))
                .on("error", (err) => { reject(err) })
                .on("finish", ()=>{
                    if (logs >= 2) log(`Finished - All CSS for ${variant} are concatenated`);
                    resolve(true);
                });
        });
    } else return Promise.resolve();
}

function sassCompiler(type, variant){
    // console.log('type:', type, '| variant:', variant);

    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - in SASS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    }

    if (type === 'sass'){
        return new Promise((resolve, reject) => {
            gulp.src(`./assets/sass/${variant}.scss`)
                .pipe(gulpSourcemaps.init())
                .pipe(gulpSass())
                .pipe(concat(`${variant}-wscss-sass.css`))
                .pipe(gulpSourcemaps.write())
                .pipe(gulp.dest(`./build/styles/${variant}`))
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
    // console.log('type:', type, '| variant:', variant);

    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - in LESS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    }

    if (type === 'less'){
        return new Promise((resolve, reject) => {
            gulp.src(`./assets/less/${variant}.less`)
                .pipe(gulpSourcemaps.init())
                .pipe(gulpLess({
                    plugins: [lessAutoPrefix]
                }))
                .pipe(concat(`${variant}-wscss-less.css`))
                .pipe(gulpSourcemaps.write())
                .pipe(gulp.dest(`./build/styles/${variant}`))
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
    // console.log('type:', type, '| variant:', variant);

    if (!type || !variant){
        if (logs >= 1) log.error(`ERROR - in STYLUS compiler - type: [${type}] | variant: [${variant}]`);
        return Promise.resolve();
    }

    if (type === 'stylus'){
        return new Promise((resolve, reject) => {
            gulp.src(`./assets/stylus/${variant}.styl`)
                .pipe(gulpSourcemaps.init())
                .pipe(gulpStylus())
                .pipe(concat(`${variant}-wscss-styl.css`))
                .pipe(gulpSourcemaps.write())
                .pipe(gulp.dest(`./build/styles/${variant}`))
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

        return fs.readdirSync(`./assets/${type}/`).forEach(file => {
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

// function js() {
//     return gulp.src('./assets/js/*.js')
//         .pipe(gulpSourcemaps.init())
//             .pipe(gulpSass())
//         .pipe(gulpSourcemaps.write())
//         .pipe(gulp.dest('./build/js'))
// }

// function html() {
//     return gulp.src(['./*.html','./*.php'])
//         .pipe(htmlMIN({
//             collapseWhitespace: true,
//             ignoreCustomFragments: [ /<%[\s\S]*?%>/, /<\?[=|php]?[\s\S]*?\?>/ ]
//         }))
//         .pipe(gulp.dest('./build'));
// }

function clean() {
    return del('./build');
}



exports.clean = clean;
exports.styles = gulp.series(clean, stylesCompiler);

// exports.html = html
