try {
  require('./server/src/app');
  console.log('App loaded fine');
} catch (e) {
  require('fs').writeFileSync('crash_log.txt', e.stack);
}
