const config = {
  useIAM: true,
};

/* eslint-disable */
var gulp = require('gulp'),
  // dotenv = require('dotenv').config(),
  sass = require('gulp-ruby-sass'),
  autoprefixer = require('gulp-autoprefixer'),
  cssnano = require('cssnano'),
  postcss = require('gulp-postcss'),
  rename = require('gulp-rename'),
  del = require('del'),
  s3 = require('gulp-s3-upload')(config),
  rp = require('request-promise'),
  webpack = require('webpack-stream'),
  pjson = require('./package.json'),
  uh = require('./update_history.json'),
  rh = require('./release_history.json'),
  language = require('./modals/language.json'),
  git = require('gulp-git'),
  compareVersions = require('compare-versions'),
  exec = require('child_process').exec,
  jeditor = require("gulp-json-editor"),
  htmlmin = require('gulp-htmlmin'),
  argv = require('yargs').argv,
  merge = require('merge-stream'),
  fs = require('fs'),
  htmllint = require('gulp-htmllint'),
	fancyLog = require('fancy-log'),
  colors = require('ansi-colors'),
  gap = require('gulp-append-prepend');

var buttonUploadName = `sezzle-widget${pjson.version}.js`;
var globalCssUploadName = `sezzle-styles-global${pjson.cssversion}.css`;

const widgetServerUS = argv.local ? 'http://localhost:12121' : 'https://widget.sezzle.com';
const widgetServerEU = argv.local ? 'http://localhost:12121' : 'https://widget.eu.sezzle.com';

/**
 * Tasks for the CSS
 */

// cleans up dist directory
gulp.task('cleancss', function () {
  return del(['dist/global-css/**']);
});

// compiles scss and minifies
gulp.task('csscompile', function () {
  return sass('./styles/global.scss', {
    style: 'expanded'
  }
  )
    .pipe(autoprefixer('last 2 version'))
    .pipe(gulp.dest('dist/global-css'))
    .pipe(rename({
      suffix: '.min'
    }))
    .pipe(postcss([cssnano()]))
    .pipe(gulp.dest('dist/global-css'))
});

gulp.task('cssupload', function () {
  // bucket base url https://d3svog4tlx445w.cloudfront.net/
  var indexPath = './dist/global-css/global.min.css'
  return gulp.src(indexPath)
    .pipe(rename(`shopify-app/assets/${globalCssUploadName}`))
    .pipe(s3({
      Bucket: 'sezzlemedia', //  Required
      ACL: 'public-read'       //  Needs to be user-defined
    }, {
        maxRetries: 5
      }))
});

function postButtonCssToWrapper(url, done) {
  console.log('Posting css version to shopify gateway')
  var options = {
    method: 'POST',
    uri: url,
    body: {
      'version_name': globalCssUploadName
    },
    json: true
  }
  return rp(options)
    .then(function (body) {
      console.log('Posted new version to shopify wrapper')
      done();
    })
    .catch(function (err) {
      console.log('Post failed with sezzle pay, ')
      console.log(err);
      done(err);
    })
}

gulp.task('post-button-css-to-wrapper', function(done){
  postButtonCssToWrapper(`${widgetServerUS}/v1/css/price-widget/version`, done);
});
gulp.task('post-button-css-to-wrapper-eu', function(done){
  postButtonCssToWrapper(`${widgetServerEU}/v1/css/price-widget/version`, done);
});

/**
 * Tasks for the modal
 */

gulp.task('cleanmodal', function () {
  return del(['dist/modal*/**']);
});

gulp.task('csscompile-modal', function () {
  return sass(`./modals/modals-${pjson.modalversion}/modal.scss`, {
    style: 'expanded'
  })
  .pipe(autoprefixer('last 2 version'))
  .pipe(gulp.dest('dist/modal-css'))
  .pipe(rename({
    suffix: '.min'
  }))
  .pipe(postcss([cssnano()]))
  .pipe(gulp.dest('dist/modal-css'))
});

// minifies html for modal
gulp.task('minify-modal', function () {
  const languages = language[pjson.modalversion];
  let steams = [];
  var style = ''
  try {
    style = fs.readFileSync('./dist/modal-css/modal.min.css', 'utf8');
  } catch (err) {
    style = '';
  }
  languages.forEach((lang) => {
    const steam = gulp.src(`./modals/modals-${pjson.modalversion}/modal-${lang}.html`)
      .pipe(gap.prependText('<style>\n' + style + '\n</style>'))
      .pipe(htmlmin({ collapseWhitespace: true, minifyCSS: true }))
      .pipe(rename(`sezzle-modal-${pjson.modalversion}-${lang}.html`))
      .pipe(gulp.dest(`dist/modals-${pjson.modalversion}`));
    steams.push(steam);
  });
	return merge(steams);
});

gulp.task('minify-modal-update', function () {
  const languages = language[uh.modal];
  let steams = [];
  var style = ''
  try {
    style = fs.readFileSync('./dist/modal-css/modal.min.css', 'utf8');
  } catch (err) {
    style = '';
  }
  languages.forEach((lang) => {
    const steam = gulp.src(`./modals/modals-${uh.modal}/modal-${lang}.html`)
      .pipe(gap.prependText('<style>\n' + style + '\n</style>'))
      .pipe(htmlmin({ collapseWhitespace: true, minifyCSS: true }))
      .pipe(rename(`sezzle-modal-${uh.modal}-${lang}.html`))
      .pipe(gulp.dest(`dist/modals-${uh.modal}`));
    steams.push(steam);
  });
	return merge(steams);
});

gulp.task('csscompile-modal-update', function () {
  return sass(`./modals/modals-${uh.modal}/modal.scss`, {
    style: 'expanded'
  })
  .pipe(autoprefixer('last 2 version'))
  .pipe(gulp.dest('dist/modal-css'))
  .pipe(rename({
    suffix: '.min'
  }))
  .pipe(postcss([cssnano()]))
  .pipe(gulp.dest('dist/modal-css'))
});

gulp.task('modalupload', function () {
  // bucket base url https://d3svog4tlx445w.cloudfront.net/
  const languages = language[pjson.modalversion];
  let steams = [];
  languages.forEach((lang) => {
    var indexPath = `./dist/modals-${pjson.modalversion}/sezzle-modal-${pjson.modalversion}-${lang}.html`;
    const steam = gulp.src(indexPath)
      .pipe(rename(`shopify-app/assets/sezzle-modal-${pjson.modalversion}-${lang}.html`))
      .pipe(s3({
        Bucket: 'sezzlemedia', //  Required
        ACL: 'public-read'     //  Needs to be user-defined
      }, {
        maxRetries: 5
      }))
    steams.push(steam);
  });
  return merge(steams);
});

gulp.task('modalupload-update', function () {
  // bucket base url https://d3svog4tlx445w.cloudfront.net/
  const languages = language[uh.modal];
  let steams = [];
  languages.forEach((lang) => {
    var indexPath = `./dist/modals-${uh.modal}/sezzle-modal-${uh.modal}-${lang}.html`;
    const steam = gulp.src(indexPath)
      .pipe(rename(`shopify-app/assets/sezzle-modal-${uh.modal}-${lang}.html`))
      .pipe(s3({
        Bucket: 'sezzlemedia', //  Required
        ACL: 'public-read'     //  Needs to be user-defined
      }, {
        maxRetries: 5
      }))
    steams.push(steam);
  });
  return merge(steams);
});

function postModalToWrapper(url, done) {
  console.log('Posting modal version to shopify gateway')
  const options = {
    method: 'POST',
    uri: url,
    body: {
      'version': `sezzle-modal-${pjson.modalversion}-{%%s%%}.html`,
      'languages': language[pjson.modalversion]
    },
    json: true
  }
  return rp(options)
    .then(function (body) {
      console.log('Posted new modal version to shopify wrapper')
      done();
    })
    .catch(function (err) {
      console.log('Post failed with sezzle pay, ')
      console.log(err);
      done(err);
    })
}

gulp.task('post-modal-to-wrapper', function(done){
  postModalToWrapper(`${widgetServerUS}/v1/modal/price-widget/version`, done);
});
gulp.task('post-modal-to-wrapper-eu', function(done){
  postModalToWrapper(`${widgetServerEU}/v1/modal/price-widget/version`, done);
});

/**
 * Tasks for the sezzle-js widget
 */

gulp.task('bundlejs', function () {
  return gulp.src('src/classBased/sezzle-init.js')
    .pipe(webpack({
      module: {
        rules: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env']
              }
            }
          }
        ]
      },
      output: {
        filename: buttonUploadName
      },
      optimization: {
        minimize: true // <---- disables uglify.
      },
      mode: 'production'
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('upload-widget', function (done) {
  var indexPath = `./dist/${buttonUploadName}`
  return gulp.src(indexPath)
    .pipe(s3({
      Bucket: 'sezzle-shopify-application', //  Required
      ACL: 'public-read'       //  Needs to be user-defined
    }, {
        // S3 Constructor Options, ie:
        maxRetries: 5
      }));
});

function postButtonToWidgetServer(url, done) {
  var options = {
    method: 'POST',
    uri: url,
    body: {
      'version_name': buttonUploadName
    },
    json: true
  }
  return rp(options)
    .then(function (body) {
      console.log('Posted new version to shopify wrapper')
      done();
    })
    .catch(function (err) {
      console.log('Post failed with shopify, ')
      console.log(err);
      done(err);
    })
}

gulp.task('post-button-to-widget-server', function(done){
  postButtonToWidgetServer(`${widgetServerUS}/v1/javascript/price-widget/version`, done);
});
gulp.task('post-button-to-widget-server-eu', function(done){
  postButtonToWidgetServer(`${widgetServerEU}/v1/javascript/price-widget/version`, done);
});

function versionCheck(oldVersion) {
  newVersion = argv.newversion;
  if (typeof (newVersion) === 'boolean' ||
    typeof (newVersion) === 'undefined' ||
    !(/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(newVersion)) ||
    compareVersions(newVersion, oldVersion) < 1
  ) {
    throw 'Invalid value for newversion';
  };
}

gulp.task('grabversion', function (done) {
  versionCheck(pjson.version);
  done();
});

gulp.task('grabversioncss', function (done) {
  versionCheck(pjson.cssversion);
  done();
});

gulp.task('grabversionmodal', function (done) {
  // versionCheck('0.0.0'); // any of the modal versions can be released irrespective of numbers
  if (rh[`modal-${argv.newversion}`]) {
    throw 'Can not be released again. Try updating';
  }
  if (!language[argv.newversion]) {
    throw 'No language defined for this version';
  } else {
    language[argv.newversion].forEach(lang => {
      fs.access(`./modals/modals-${argv.newversion}/modal-${lang}.html`, (err) => {
        if (err) {
          throw `No file found: ./modals/modals-${argv.newversion}/modal-${lang}.html`;
        }
      });
    });
  }
  done();
});

function updateVersion(params) {
  return gulp.src(['./package.json', './package-lock.json'])
    .pipe(jeditor(params))
    .pipe(gulp.dest('./'));
}

function commitReleaseVersion(type, version) {
  return gulp.src('./package.json')
    .pipe(git.commit(`bumped ${type} version to: ${version}`));
}

gulp.task('validate-modal', function(done) {
  language[argv.newversion].forEach(lang => {
	  return gulp.src(`./modals/modals-${argv.newversion}/modal-${lang}.html`)
      .pipe(htmllint({config: './.htmllintrc'}, (filepath, issues) => {
        if (issues.length > 0) {
          issues.forEach(function (issue) {
            fancyLog(colors.cyan('[gulp-htmllint] ') + colors.white(filepath + ' [' + issue.line + ',' + issue.column + ']: ') + colors.red('(' + issue.code + ') ' + issue.msg));
          });
          throw `Fix the  lintings: ./modals/modals-${argv.newversion}/modal-${lang}.html`;
        }
        done();
      }));
  });
});

gulp.task('updatepackage', function() {
  return updateVersion({version: argv.newversion});
});

gulp.task('updatepackagecss', function() {
  return updateVersion({cssversion: argv.newversion});
});

gulp.task('updatepackagemodal', function() {
  return updateVersion({modalversion: argv.newversion});
});

gulp.task('logrelease-modal', function() {
  let param = {};
  param[`modal-${argv.newversion}`] = (new Date()).toUTCString();
  return logReleaseHistory(param);
});

gulp.task('commitrelease', function() {
  return commitReleaseVersion('js', argv.newversion);
});

gulp.task('commitupdate', function() {
  return commitUpdateVersion('js', argv.version);
});

gulp.task('commitupdatecss', function() {
  return commitReleaseVersion('css', argv.newversion);
});

gulp.task('commitupdatemodal', function() {
  return commitReleaseVersion('modal', argv.newversion);
});

gulp.task('createtag', function (done) {
  git.tag(`v${argv.newversion}`, '', function (err) {
    if (err) throw err;
    git.push('origin', `v${argv.newversion}`, function (err) {
      if (err) throw err;
      done();
    });
  });
});

function getbranchName(type) {
  return `version-${type}-${argv.newversion}`;
}

function createBranch(branchName, done) {
  git.checkout('master', function (err) {
    if (err) throw err;
    git.branch(branchName, {args:'-D'}, function (err) {
      if (err) console.log(err.cmd, 'failed');
      git.push('origin', branchName, {args:'--delete'}, function(err){
        if (err) console.log(err.cmd, 'failed');
        git.pull('origin', 'master', function (err) {
          if (err) throw err;
          git.checkout(branchName, { args: '-b' }, function (err) {
            if (err) throw err;
            done();
          });
        });
      });
    });
  })
}

function deleteBranch(branchName, done) {

}

gulp.task('newbranch', function (done) {
  createBranch(getbranchName('js'), done);
});
gulp.task('newbranchcss', function (done) {
  createBranch(getbranchName('css'), done);
});
gulp.task('newbranchmodal', function (done) {
  createBranch(getbranchName('modal'), done);
});

function pushBranch(branchName, done) {
  git.push('origin', branchName, function (err) {
    if (err) throw err;
    done();
  });
}
gulp.task('pushversion', function (done) {
  pushBranch(getbranchName('js'), done);
});
gulp.task('pushversioncss', function (done) {
  pushBranch(getbranchName('css'), done);
});
gulp.task('pushversionmodal', function (done) {
  pushBranch(getbranchName('modal'), done);
});

gulp.task('styles', gulp.series('cleancss', 'csscompile'));

// Tracker tasks
gulp.task('bundletracker', function () {
  return gulp.src('src/ShopifyTracker/tracker.js')
    .pipe(webpack({
      module: {
        rules: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules)/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env']
              }
            }
          }
        ]
      },
      output: {
        filename: 'shopifyTracker.js'
      },
      optimization: {
        minimize: true // <---- disables uglify.
      },
      mode: 'production'
    }))
    .pipe(gulp.dest('dist/'));
});

//TODO: Add Gulp task to upload ./dist/shopifyTracker.js
gulp.task('uploadtracker', function () {
  // bucket base url https://d3svog4tlx445w.cloudfront.net/
  var indexPath = `./dist/shopifyTracker.js`;
  return gulp.src(indexPath)
    .pipe(rename(`tracking/assets/tracking.js`))
    .pipe(s3({
      Bucket: 'sezzlemedia', //  Required
      ACL: 'public-read'     //  Needs to be user-defined
    }, {
      maxRetries: 5
    }))
});

gulp.task('deploywidget', gulp.series('bundlejs', 'upload-widget', gulp.parallel('post-button-to-widget-server', 'post-button-to-widget-server-eu')));
gulp.task('deploycss', gulp.series('styles', 'cssupload', gulp.parallel('post-button-css-to-wrapper', 'post-button-css-to-wrapper-eu')));
gulp.task('deploymodal', gulp.series('cleanmodal', 'csscompile-modal', 'minify-modal', 'modalupload', gulp.parallel('post-modal-to-wrapper', 'post-modal-to-wrapper-eu')));
gulp.task('deploytracker', gulp.series('bundletracker', 'uploadtracker'));

// local processes
gulp.task('release', gulp.series('grabversion', 'newbranch', 'updatepackage', 'commitrelease', 'pushversion'));
gulp.task('release-css', gulp.series('grabversioncss', 'newbranchcss', 'updatepackagecss', 'commitupdatecss', 'pushversioncss'));
gulp.task('release-modal', gulp.series('grabversionmodal', 'validate-modal', 'newbranchmodal', 'updatepackagemodal', 'logrelease-modal', 'commitupdatemodal', 'pushversionmodal'));



// Update modal existing version
function logUpdateHistory(params) {
  return gulp.src(['./update_history.json'])
    .pipe(jeditor(params))
    .pipe(gulp.dest('./'));
}

function logReleaseHistory(params) {
  return gulp.src(['./release_history.json'])
    .pipe(jeditor(params))
    .pipe(gulp.dest('./'));
}

function versionCheckForUpdate(oldVersion) {
  update_version = argv.updateversion;
  if (typeof (update_version) === 'boolean' ||
    typeof (update_version) === 'undefined' ||
    !(/^\d{1,2}\.\d{1,2}\.\d{1,2}$/.test(update_version)) ||
    compareVersions(oldVersion, update_version) === -1
  ) {
    throw 'Invalid value for updateversion' + update_version + ', ' + oldVersion + ', ' + compareVersions(oldVersion, update_version);
  };
}

function commitUpdateVersion(type, version) {
  return gulp.src('./update_history.json')
    .pipe(git.commit(`updated ${type} version: ${version}`));
}

function getUpdateBranchName(type) {
  return `version-update-${type}-${argv.updateversion}`;
}

gulp.task('modal-version-check-for-update', function(done) {
  versionCheckForUpdate(pjson.modalversion);
  if (!language[argv.updateversion]) {
    throw 'No language defined for this version';
  } else {
    language[argv.updateversion].forEach(lang => {
      fs.access(`./modals/modals-${argv.updateversion}/modal-${lang}.html`, (err) => {
        if (err) {
          throw `No file found: ./modals/modals-${argv.updateversion}/modal-${lang}.html`;
        }
      });
    });
  }
  done();
});

gulp.task('logupdate-modal', function() {
  let param = {};
  param[`modal-${argv.updateversion}`] = (new Date()).toUTCString();
  param['modal'] = argv.updateversion;
  return logUpdateHistory(param);
});

gulp.task('commitupdate-modal', function() {
  return commitUpdateVersion('modal', argv.updateversion);
});

gulp.task('branchupdate-modal', function(done) {
  createBranch(getUpdateBranchName('modal'), done);
})

gulp.task('pushversionmodal-modal', function (done) {
  pushBranch(getUpdateBranchName('modal'), done);
});

gulp.task('update-modal', gulp.series('modal-version-check-for-update', 'branchupdate-modal', 'logupdate-modal', 'commitupdate-modal', 'pushversionmodal-modal'));
gulp.task('deployupdatemodal', gulp.series('cleanmodal', 'csscompile-modal-update', 'minify-modal-update', 'modalupload-update'));

// CI processes
gulp.task('deploy', function (done) {
  // Check if there is any version commit
  exec('git log --pretty=format:%s -2 | tail', function (err, stdout, stderr) {
    if (err) throw err;
    var commits = stdout.split('\n');
    if (commits.length === 2) {
      var versionCommit = '';
      // check if the first commit is a Merge commit
      if (commits[0].indexOf('Merge pull request') > -1) {
        // Then the second commit should be the version commit
        versionCommit = commits[1];
      } else {
        // Or the first commit should be the version commit
        versionCommit = commits[0];
      }
      if (versionCommit.indexOf('bumped js version to:') > -1) {
        console.log(versionCommit);
        console.log('Updating JS version');
        exec('npx gulp deploywidget', function (err, stdout, stderr) {
          if (err) throw err;
          console.log(stdout);
          done();
        });
      } else if (versionCommit.indexOf('bumped css version to:') > -1) {
        console.log(versionCommit);
        console.log('Updating CSS version');
        exec('npx gulp deploycss', function (err, stdout, stderr) {
          if (err) throw err;
          console.log(stdout);
          done();
        })
      } else if (versionCommit.indexOf('bumped modal version to:') > -1) {
        console.log(versionCommit);
        console.log('Updating Modal version');
        exec('npx gulp deploymodal', function (err, stdout, stderr) {
          if (err) throw err;
          console.log(stdout);
          done();
        })
      } else if (versionCommit.indexOf('updated modal version:') > -1) {
        console.log('Updating Modal');
        exec('npx gulp deployupdatemodal', function (err, stdout, stderr) {
          if (err) throw err;
          console.log(stdout);
          done();
        })
      } else if (versionCommit.indexOf('updated tracker:') > -1) {
        console.log('Updating Tracker');
        exec('npx gulp deploytracker', function (err, stdout, stderr) {
          if (err) throw err;
          console.log(stdout);
          done();
        })
      } else {
        console.log('No version change commit found');
        done();
      }
    } else {
      console.log('No version change commit found');
      done();
    }
  })
});
