var theme = 'begonia';

// This is not a normal require, because our gulp-help tool (which provides the
// nice task descriptions on the command-line) requires changing the function
// signature of gulp tasks to include the task description.
var gulp = require('gulp-help')(require('gulp'));

// Gulp / Node utilities
var u = require('gulp-util');
var log = u.log;
var c = u.colors;
var exec = require('gulp-exec');
var spawn = require('child_process').spawn;
var del = require('del');
var fs = require('fs');

// Basic workflow plugins
var prefix = require('gulp-autoprefixer');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var rename = require('gulp-rename');
var csscomb = require('gulp-csscomb');
var rtlcss = require('gulp-rtlcss');
var concat = require('gulp-concat');
var iife = require("gulp-iife");
var bs = require('browser-sync');
var reload = bs.reload;

var jsFiles = [
    './assets/js/modules/*.js',
    './assets/js/main/main.js',
    './assets/js/main/unsorted.js',
    './assets/js/vendor/*.js'
];

var config = require('./gulpconfig.json');

// -----------------------------------------------------------------------------
// Sass Tasks
//
// Compiles Sass and runs the CSS through autoprefixer. A separate task will
// combine the compiled CSS with vendor files and minify the aggregate.
// -----------------------------------------------------------------------------
gulp.task('style.css', 'Compiles Sass to style.css and uses autoprefixer', function() {
    return gulp.src('assets/scss/*.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({outputStyle: 'nested'}).on('error', sass.logError))
        .pipe(prefix("last 2 versions", "> 1%"))
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('.'));
});

gulp.task('rtl.css', 'Generates RTL stylesheet based on style.css', ['style.css'], function() {
    return gulp.src('style.css')
        .pipe(rtlcss())
        .pipe(rename('rtl.css'))
        .pipe(gulp.dest('.'));
});

gulp.task('styles', 'Compiles Sass to style.css and generates rtl.css', ['rtl.css'], function() {
    // silcence
});

// -----------------------------------------------------------------------------
// Combine JavaScript files
// -----------------------------------------------------------------------------
gulp.task('scripts', 'Concatenate all JS into main.js and wrap all code in a closure', function () {
    return gulp.src(['./assets/js/**/*.js', '!./assets/js/main.js'])
    // Concatenate all our files into main.js
        .pipe(concat('main.js'))
        // Wrap all js logic in an immediately invoked function expression (iife)
        .pipe(iife({
            params: ["window", "document", "$"],
            args: ["window", "document", "jQuery"]
        }))
        .pipe(gulp.dest('./assets/js/'));
});

// -----------------------------------------------------------------------------
// Browser Sync using Proxy server
//
// Makes web development better by eliminating the need to refresh. Essential
// for CSS development and multi-device testing.
//
// This is how you'd connect to a local server that runs itself.
// Examples would be a PHP site such as Wordpress or a
// Drupal site, or a node.js site like Express.
//
// Usage: gulp browser-sync-proxy --port 8080
// -----------------------------------------------------------------------------
gulp.task('browser-sync', false, function () {
    bs({
        // Point this to your pre-existing server.
        proxy: config.baseurl + (u.env.port ? ':' + u.env.port : ''),
        files: ['*.php', 'style.css', 'assets/js/main.js'],
        // This tells BrowserSync to auto-open a tab once it boots.
        open: true
    }, function(err, bs) {
        if (err) {
            console.log(bs.options);
        }
    });
});


// -----------------------------------------------------------------------------
// Watch tasks
//
// These tasks are run whenever a file is saved. Don't confuse the files being
// watched (gulp.watch blobs in this task) with the files actually operated on
// by the gulp.src blobs in each individual task.
//
// A few of the performance-related tasks are excluded because they can take a
// bit of time to run and don't need to happen on every file change. If you want
// to run those tasks more frequently, set up a new watch task here.
// -----------------------------------------------------------------------------
gulp.task('watch', 'Watch for changes to various files and process them', function() {
    gulp.watch('assets/scss/**/*.scss', ['styles']);
    gulp.watch('assets/js/**/*.js', ['scripts']);
});

// -----------------------------------------------------------------------------
// Convenience task for development.
//
// This is the command you run to warm the site up for development. It will do
// a full build, open BrowserSync, and start listening for changes.
// -----------------------------------------------------------------------------
gulp.task('bs', 'Main development task:', ['styles', 'scripts', 'browser-sync', 'watch']);

// -----------------------------------------------------------------------------
// Copy theme folder outside in a build folder, recreate styles before that
// -----------------------------------------------------------------------------
gulp.task('copy-folder', 'Copy theme production files to a build folder', ['styles', 'scripts'], function () {
    return gulp.src('./')
        .pipe(exec('rm -Rf ./../build; mkdir -p ./../build/' + theme + '; rsync -av --exclude="node_modules" ./* ./../build/' + theme + '/', {
            silent: true,
            continueOnError: true // default: false
        }));
});

// -----------------------------------------------------------------------------
// Remove unneeded files and folders from the build folder
// -----------------------------------------------------------------------------
gulp.task('build', 'Remove unneeded files and folders from the build folder', ['copy-folder'], function () {

    // files that should not be present in build
    files_to_remove = [
        '**/codekit-config.json',
        'node_modules',
        'config.rb',
        'gulpfile.js',
        'gulpconfig.js',
        'gulpconfig.json',
        'package.json',
        'pxg.json',
        'build',
        'css',
        '.idea',
        '**/.svn*',
        '**/*.css.map',
        '**/.sass*',
        '.sass*',
        '**/.git*',
        '*.sublime-project',
        '.DS_Store',
        '**/.DS_Store',
        '__MACOSX',
        '**/__MACOSX',
        'README.md',
        '.csscomb',
        '.codeclimate.yml'
    ];

    files_to_remove.forEach(function (e, k) {
        files_to_remove[k] = '../build/' + theme + '/' + e;
    });

    return del.sync(files_to_remove, {force: true});
});

// -----------------------------------------------------------------------------
// Create the theme installer archive and delete the build folder
// -----------------------------------------------------------------------------
gulp.task('zip', 'Create the theme installer archive and delete the build folder', ['build'], function() {

    var versionString = '';
    // get theme version from styles.css
    var contents = fs.readFileSync("./style.css", "utf8");

    // split it by lines
    var lines = contents.split(/[\r\n]/);

    function checkIfVersionLine(value, index, ar) {
        var myRegEx = /^[Vv]ersion:/;
        if ( myRegEx.test(value) ) {
            return true;
        }
        return false;
    }

    // apply the filter
    var versionLine = lines.filter(checkIfVersionLine);

    versionString = versionLine[0].replace(/^[Vv]ersion:/, '' ).trim();
    versionString = '-' + versionString.replace(/\./g,'-');

    return gulp.src('./')
        .pipe(exec('cd ./../; rm -rf ' + theme[0].toUpperCase() + theme.slice(1) + '*.zip; cd ./build/; zip -r -X ./../' + theme[0].toUpperCase() + theme.slice(1) + '-Installer' + versionString +'.zip ./; cd ./../; rm -rf build'));
});

gulp.task('server', 'Compile scripts and styles for production purposes', ['styles', 'scripts'], function () {
    console.log('The styles and scripts have been compiled for production! Go and clear the caches!');
});

// -----------------------------------------------------------------------------
// Default: load task listing
//
// Instead of launching some unspecified build process when someone innocently
// types `gulp` into the command line, we provide a task listing so they know
// what options they have without digging into the file.
// -----------------------------------------------------------------------------
gulp.task('default', false, ['help']);

gulp.task('watch', ['styles'], function() {
    gulp.watch(['assets/scss/**/*.scss', 'components/**/*.scss'], ['styles']);
});
