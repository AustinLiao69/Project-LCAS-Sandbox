const { db } = require('./Modules/Modules');
db.collection('test').add({ ts: new Date(), msg: 'hello world' })
  .then(() => console.log('OK'))
  .catch(err => console.error('ERROR:', err));