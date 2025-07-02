const { db } = require('./Modules/FB_Serviceaccountkey.js');
db.collection('test').add({ ts: new Date(), msg: 'hello world' })
  .then(() => console.log('OK'))
  .catch(err => console.error('ERROR:', err));