const gulp = require('gulp');
const eslint = require('gulp-eslint');
const shell = require('gulp-shell');
const nodemon = require('gulp-nodemon');
const path = require('path');
const jest = require('jest-cli');

const jestConfig = {
  verbose: false,
  rootDir: '.'
};

gulp.task('lint', () => {
  return gulp.src(['**/*.js', '!node_modules/**'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('jest', (done) => {
  jest.runCLI({
    config: Object.assign(jestConfig, { testMatch: ['**/test/specs/*.js'] })
  }, '.', () => done());
});

gulp.task('watch', ['js'], () =>
  nodemon({
    script: 'server/start-server-web.js',
    ext: 'js',
    watch: ['server', 'test'],
    ignore: [
      'node_modules/'
    ],
    tasks: (changedFiles) => {
      let tasks = [];
      changedFiles.forEach(file => {
        if (path.extname(file) === '.js' && !tasks.includes('js')) tasks.push('js');
      });
      return tasks;
    }
  })
);

gulp.task('js', ['lint', 'jest']);

gulp.task('default', ['js']);
