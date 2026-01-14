const admin = require('firebase-admin');

/**
 * Timestamp serveur RTDB (ms) côté Cloud Functions.
 * À utiliser à la place de Date.now() pour éviter les dérives d'horloge device.
 */
function rtdbServerTimestamp() {
  return admin.database.ServerValue.TIMESTAMP;
}

module.exports = { rtdbServerTimestamp };
