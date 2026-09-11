const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'store.json');
const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000;
let stateMutationQueue = Promise.resolve();

const APPLICATION_TYPES = ['FIRST_VERIFICATION', 'RE_VERIFICATION'];
const WORKFLOW_STATUSES = [
  'Application Submitted', 'Document Verification', 'LMO Assigned',
  'Verification Scheduled', 'Field Verification', 'GATC Verification Required',
  'GATC Assigned', 'GATC Verification Scheduled', 'Under GATC Verification',
  'Verified', 'Verification Rejected', 'Certificate Generated', 'Completed',
  'Application Rejected', 'Pending', 'Inspection Required', 'Inspection Scheduled'
];

function normalizeApplication(application) {
  const type = application.applicationType === 'Re-verification' || application.applicationType === 'RE_VERIFICATION' ||
    (!application.applicationType && application.officer && application.officer !== 'Unassigned')
    ? 'RE_VERIFICATION'
    : 'FIRST_VERIFICATION';
  application.applicationType = type;
  application.assignedLMO ||= type === 'RE_VERIFICATION' ? application.officer || 'Unassigned' : 'Unassigned';
  application.assignedGATC ||= type === 'FIRST_VERIFICATION' && application.officer !== 'Unassigned'
    ? application.officer
    : 'Unassigned';
  application.gatcRequired = Boolean(application.gatcRequired);
  application.currentStage ||= application.status === 'Verified' ? 'COMPLETED' : type === 'FIRST_VERIFICATION' ? 'DOCUMENT_VERIFICATION' : 'DOCUMENT_VERIFICATION';
  return application;
}

function publicApplication(application) {
  return normalizeApplication({ ...application });
}

const seed = {
  users: [
    { name: 'Rahul Das', email: 'rahul@example.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'User', status: 'Active' },
    { name: 'Amit Sharma', email: 'amit@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'Officer', status: 'Active' },
    { name: 'System Administrator', email: 'admin@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'Admin', status: 'Active' },
    { name: 'Kolkata GATC', email: 'gatc@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'GATC', status: 'Active' },
    { name: 'Mumbai GATC', email: 'mumbai.gatc@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'GATC', status: 'Active' },
    { name: 'Delhi GATC', email: 'delhi.gatc@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'GATC', status: 'Active' },
    { name: 'Bengaluru GATC', email: 'bengaluru.gatc@ovs-wm.com', passwordHash: 'scrypt$8f3615bfe773aea1a749d30eec073bb4$f59c59031896197d76884852a3f2c13bc891bc876f8c3ce6805e13a76a6dec6bbf7f5dd9fc3853d06eab1da375942cdb51a9a9e5cc7d31060a17abcc d1536ea2'.replace(' ', ''), role: 'GATC', status: 'Active' }
  ],
  applications: [
    { id: 'OVS/2026/00021', applicant: 'Rahul Das', instrument: 'Digital Weighing Scale', officer: 'Amit Sharma', status: 'Verified', date: '28 Aug 2026', location: 'Kolkata' },
    { id: 'OVS/2026/00022', applicant: 'Metro Stores', instrument: 'Platform Scale', officer: 'Amit Sharma', status: 'Inspection Required', date: '29 Aug 2026', location: 'Kolkata' },
    { id: 'OVS/2026/00024', applicant: 'Green Foods', instrument: 'Electronic Balance', officer: 'Unassigned', status: 'Pending', date: '30 Aug 2026', location: 'Howrah' }
  ],
  instruments: [
    { id: 'INS-001', owner: 'Rahul Das', name: 'Digital Weighing Scale', category: 'Weighing Instrument', location: 'Kolkata', status: 'Verified', validUntil: '19 Aug 2027' },
    { id: 'INS-002', owner: 'Rahul Das', name: 'Platform Scale', category: 'Weighing Instrument', location: 'Howrah', status: 'Pending', validUntil: 'Inspection required' },
    { id: 'INS-003', owner: 'Rahul Das', name: 'Electronic Balance', category: 'Measuring Instrument', location: 'Kolkata', status: 'Verified', validUntil: '11 Jul 2027' }
  ],
  certificates: [
    { id: 'W&M/26-27/00045', applicationId: 'OVS/2026/00021', applicant: 'Rahul Das', instrument: 'Digital Weighing Scale', issuedOn: '19 Aug 2026', validUntil: '19 Aug 2027', issuedBy: 'Amit Sharma', status: 'Active' }
  ],
  officers: [
    { name: 'Amit Sharma', email: 'amit@ovs-wm.com', assigned: 12, status: 'Active' },
    { name: 'Neha Roy', email: 'neha@ovs-wm.com', assigned: 8, status: 'Active' },
    { name: 'Rakesh Kumar', email: 'rakesh@ovs-wm.com', assigned: 0, status: 'On Leave' },
    { name: 'Kolkata GATC', email: 'gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Mumbai GATC', email: 'mumbai.gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Delhi GATC', email: 'delhi.gatc@ovs-wm.com', assigned: 0, status: 'Active' },
    { name: 'Bengaluru GATC', email: 'bengaluru.gatc@ovs-wm.com', assigned: 0, status: 'Active' }
  ],
  officerRequests: [],
  enforcementCases: [],
  settings: { maintenance: false, emailNotifications: true, autoAssignment: true }
};

async function ensureStore() {
  try {
    const store = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const existingUsers = new Map(store.users.map(user => [user.email, user]));
    const seededUsers = seed.users.map(user => existingUsers.get(user.email) || user);
    const additionalUsers = store.users.filter(user => !seed.users.some(seedUser => seedUser.email === user.email));
    store.users = [...seededUsers, ...additionalUsers];
    store.officers ||= [];
    const usersByEmail = new Map(store.users.map(user => [user.email, user]));
    store.officers.forEach(officer => {
      const account = usersByEmail.get(officer.email);
      if (account) officer.role ||= account.role;
    });
    const verifierRecords = new Set(store.officers.map(officer => officer.email));
    store.users.filter(user => ['Officer', 'GATC'].includes(user.role) && !verifierRecords.has(user.email))
      .forEach(user => store.officers.push({
        name: user.name,
        email: user.email,
        role: user.role,
        assigned: 0,
        status: user.status === 'Active' ? 'Active' : 'On Leave'
      }));
    store.officerRequests ||= [];
    store.enforcementCases ||= [];
    store.settings = { ...seed.settings, ...store.settings };
    store.applications = store.applications.map(normalizeApplication);
    await migrateCredentials(store);
    await saveStore(store);
    return store;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const initialStore = structuredClone(seed);
    await migrateCredentials(initialStore);
    await fs.writeFile(DATA_FILE, JSON.stringify(initialStore, null, 2));
    return initialStore;
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function json(response, status, payload) {
  if (response.headersSent || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function body(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', chunk => { raw += chunk; if (raw.length > 20e6) reject(new Error('Payload too large')); });
    request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } });
    request.on('error', reject);
  });
}

function cookie(request, name) {
  return request.headers.cookie?.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.slice(name.length + 1);
}

function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `ovs_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...user, expiresAt: Date.now() + SESSION_TTL });
  return token;
}

function currentUser(request, store) {
  const token = cookie(request, 'ovs_session');
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  const account = store.users.find(item => item.email.toLowerCase() === session.email.toLowerCase());
  if (!account || account.status !== 'Active') {
    sessions.delete(token);
    return null;
  }
  session.name = account.name;
  session.email = account.email;
  session.role = account.role;
  return session;
}

function publicUser(user) {
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function certificateLifecycle(certificate) {
  const expiry = new Date(certificate.validUntil);
  if (Number.isNaN(expiry.getTime()) || certificate.status !== 'Active') return certificate.status;
  const days = Math.ceil((expiry.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Active';
}

function publicCertificate(certificate) {
  return {
    id: certificate.id,
    applicationId: certificate.applicationId,
    applicant: certificate.applicant,
    instrument: certificate.instrument,
    issuedOn: certificate.issuedOn,
    validUntil: certificate.validUntil,
    issuedBy: certificate.issuedBy,
    verificationType: certificate.verificationType,
    instrumentId: certificate.instrumentId,
    status: certificateLifecycle(certificate)
  };
}

function publicInstrument(instrument, includeDocuments = false) {
  if (includeDocuments) return instrument;
  const { documents, ...safeInstrument } = instrument;
  return safeInstrument;
}

function publicStore(store, user = {}) {
  const role = typeof user === 'string' ? user : user.role;
  const name = typeof user === 'object' ? user.name : '';
  const visibleApplications = role === 'Officer'
    ? store.applications.filter(item => item.assignedLMO === name || item.officer === name)
    : role === 'GATC'
      ? store.applications.filter(item => item.assignedGATC === name || item.officer === name)
      : role === 'User'
        ? store.applications.filter(item => item.applicant === name)
        : store.applications;
  const visibleApplicationIds = new Set(visibleApplications.map(item => item.id));
  const visibleCertificates = role === 'User'
    ? store.certificates.filter(item => item.applicant === name)
    : role === 'Admin'
      ? store.certificates
      : store.certificates.filter(item => item.issuedBy === name || visibleApplicationIds.has(item.applicationId));
  const safeStore = {
    applications: visibleApplications.map(publicApplication),
    instruments: role === 'User'
      ? store.instruments.filter(item => item.owner === name)
      : store.instruments.map(item => publicInstrument(item, role === 'Admin')),
    certificates: visibleCertificates.map(publicCertificate),
    users: role === 'Admin'
      ? store.users.map(publicUser)
      : ['Officer', 'GATC'].includes(role)
        ? store.users.filter(item => ['Officer', 'GATC'].includes(item.role)).map(({ name, role: accountRole, status }) => ({
          name,
          role: accountRole,
          status
        }))
        : [],
    officers: role === 'Admin' || role === 'Officer' || role === 'GATC' ? store.officers : [],
    enforcementCases: role === 'Admin' ? store.enforcementCases : [],
    settings: role === 'Admin' ? store.settings : {}
  };
  if (role === 'Admin') safeStore.officerRequests = store.officerRequests.map(({ password, passwordHash, ...request }) => request);
  return safeStore;
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(16, (error, salt) => {
      if (error) return reject(error);
      crypto.scrypt(password, salt, 64, (scryptError, key) => {
        if (scryptError) return reject(scryptError);
        resolve(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`);
      });
    });
  });
}

async function migrateCredentials(store) {
  let changed = false;
  for (const user of store.users) {
    if (user.password && !user.passwordHash) {
      user.passwordHash = await hashPassword(user.password);
      delete user.password;
      changed = true;
    }
  }
  for (const request of store.officerRequests || []) {
    if (request.password && !request.passwordHash) {
      request.passwordHash = await hashPassword(request.password);
      delete request.password;
      changed = true;
    }
  }
  if (changed) await saveStore(store);
}

function verifyPassword(password, stored) {
  if (!stored?.startsWith('scrypt$')) return Promise.resolve(stored === password);
  const [, saltHex, keyHex] = stored.split('$');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (error, key) => {
      if (error) return reject(error);
      resolve(crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex')));
    });
  });
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function reject(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function validateUserCollections(store, input, user) {
  if (input.certificates !== undefined) {
    if (!Array.isArray(input.certificates) || input.certificates.some(item => item.applicant !== user.name)) {
      reject('Certificates must belong to the signed-in user');
    }
    const existingOwnedCertificates = store.certificates.filter(item => item.applicant === user.name);
    if (!sameRecord(input.certificates, existingOwnedCertificates)) reject('Users cannot modify certificates');
  }

  if (input.applications !== undefined) {
    if (!Array.isArray(input.applications)) reject('Applications must be an array');
    const owned = input.applications.filter(item => item.applicant === user.name);
    if (owned.length !== input.applications.length) reject('Applications must belong to the signed-in user');
    const existingOwned = store.applications.filter(item => item.applicant === user.name);
    for (const item of owned) {
      const previous = existingOwned.find(record => record.id === item.id);
      if (previous && !sameRecord(previous, item)) reject('Existing applications cannot be edited by users');
      const instrument = store.instruments.find(record => record.owner === user.name &&
        (record.id === item.instrumentId || record.name === item.instrument));
      if (!previous && !instrument) reject('Applications must reference one of your registered instruments');
      if (!previous && (item.status !== 'Application Submitted' || item.currentStage !== 'DOCUMENT_VERIFICATION' ||
        item.officer !== 'Unassigned' || !APPLICATION_TYPES.includes(item.applicationType) ||
        item.assignedLMO !== 'Unassigned' || item.assignedGATC !== 'Unassigned')) {
        reject('New applications must start in document verification with no verifier assigned');
      }
    }
    const removed = existingOwned.filter(item => !owned.some(record => record.id === item.id));
    if (removed.some(item => ['Verified', 'Verification Rejected'].includes(item.status))) {
      reject('Completed applications cannot be deleted');
    }
    store.applications = store.applications
      .filter(item => item.applicant !== user.name || owned.some(record => record.id === item.id))
      .concat(owned.filter(item => !store.applications.some(record => record.id === item.id)));
  }

  if (input.instruments !== undefined) {
    if (!Array.isArray(input.instruments)) reject('Instruments must be an array');
    const owned = input.instruments.filter(item => item.owner === user.name);
    if (owned.length !== input.instruments.length) reject('Instruments must belong to the signed-in user');
    const existingOwned = store.instruments.filter(item => item.owner === user.name);
    for (const item of owned) {
      const previous = existingOwned.find(record => record.id === item.id);
      if (previous) {
        if (item.status !== previous.status || item.validUntil !== previous.validUntil) reject('Instrument verification fields are read-only');
      } else if (item.status !== 'Pending') {
        reject('New instruments must start as Pending');
      }
    }
    const removed = existingOwned.filter(item => !owned.some(record => record.id === item.id));
    if (removed.some(item => item.status === 'Verified')) reject('Verified instruments cannot be deleted');
    if (removed.some(item => store.applications.some(application =>
      application.applicant === user.name &&
      (application.instrumentId === item.id || application.instrument === item.name)))) {
      reject('Instruments referenced by applications cannot be deleted');
    }
    store.instruments = store.instruments
      .filter(item => item.owner !== user.name || owned.some(record => record.id === item.id))
      .concat(owned.filter(item => !store.instruments.some(record => record.id === item.id)));
  }
}

function validateOfficerCollections(store, input, user) {
  if (input.instruments !== undefined && !sameRecord(input.instruments, store.instruments.map(item => publicInstrument(item)))) reject('Officers cannot modify instruments');
  if (input.users !== undefined || input.officers !== undefined || input.settings !== undefined) reject('Only administrators can modify administrative data');

  if (input.applications !== undefined) {
    if (!Array.isArray(input.applications)) reject('Applications must be an array');
    const incoming = new Map(input.applications.map(item => [item.id, item]));
    const isGatc = user.role === 'GATC';
    const visibleApplications = store.applications.filter(item => isGatc
      ? item.assignedGATC === user.name || item.officer === user.name
      : item.assignedLMO === user.name || item.officer === user.name);
    if (incoming.size !== visibleApplications.length || visibleApplications.some(item => !incoming.has(item.id))) {
      reject('Officers cannot add or remove applications');
    }
    for (const previous of store.applications) {
      const item = incoming.get(previous.id);
      const previouslyAssigned = isGatc
        ? previous.assignedGATC === user.name || previous.officer === user.name
        : previous.assignedLMO === user.name || previous.officer === user.name;
      if (!previouslyAssigned) {
        continue;
      }
      const immutableFields = ['id', 'applicant', 'instrument', 'date', 'preferredDate', 'location', 'officer', 'applicationType'];
      if (immutableFields.some(key => item[key] !== previous[key])) reject('Application ownership fields are read-only');
      const assignedToUser = isGatc
        ? item.assignedGATC === user.name || item.officer === user.name
        : item.assignedLMO === user.name || item.officer === user.name;
      if (!assignedToUser) {
        if (!sameRecord(previous, item)) reject('You can only update applications assigned to you');
        continue;
      }
      const allowed = isGatc
        ? ['GATC Assigned', 'GATC Verification Scheduled', 'Under GATC Verification', 'Verified', 'Verification Rejected', 'Certificate Generated', 'Completed']
        : ['LMO Assigned', 'Verification Scheduled', 'Field Verification', 'GATC Verification Required', 'Verified', 'Verification Rejected', 'Certificate Generated', 'Completed'];
      if (!allowed.includes(item.status) && !['Inspection Required', 'Inspection Scheduled'].includes(item.status)) reject('Invalid workflow status');
      const completionStatuses = isGatc
        ? ['GATC Assigned', 'GATC Verification Scheduled', 'Under GATC Verification', 'Inspection Required', 'Inspection Scheduled']
        : ['LMO Assigned', 'Verification Scheduled', 'Field Verification', 'Inspection Required', 'Inspection Scheduled'];
      if (['Verified', 'Verification Rejected'].includes(item.status) &&
        item.status !== previous.status && !completionStatuses.includes(previous.status)) {
        reject('Verification result is not valid for the current workflow stage');
      }
      if (['Certificate Generated', 'Completed'].includes(item.status) &&
        item.status !== previous.status && !['Verified', 'Certificate Generated'].includes(previous.status)) {
        reject('Certificate workflow must follow verification');
      }
      if (['Verification Scheduled', 'Inspection Scheduled', 'GATC Verification Scheduled'].includes(item.status) &&
        item.scheduledBy !== user.name) reject('Schedule must record the assigned verifier');
      if (item.status === 'GATC Verification Required') {
        if (isGatc || item.applicationType !== 'RE_VERIFICATION' || !item.gatcRequired ||
          !item.fieldVerification?.reason || !item.fieldVerification?.observations) {
          reject('GATC transfer requires a complete LMO field verification');
        }
      }
      if (!sameRecord(previous, item) && ['Verified', 'Verification Rejected'].includes(item.status)) {
        if (item.inspectedBy !== user.name || item.inspection?.conductedBy !== user.name ||
          !item.inspection.standard || !item.inspection.observedReading ||
          !item.inspection.permissibleError || !item.inspection.observations) {
          reject('Inspection results require complete observations and officer identity');
        }
      }
      if (item.status === 'Verification Rejected' && !item.verificationRejectionReason) reject('Verification rejection requires a reason');
      if (item.status === 'Verified') {
        if (isGatc && item.applicationType === 'RE_VERIFICATION' && !item.gatcRequired) reject('Re-verification must complete LMO field verification first');
        if (!isGatc && item.applicationType !== 'RE_VERIFICATION') reject('First verification must be completed by a GATC');
      }
    }
    store.applications = store.applications.map(previous => incoming.get(previous.id) || previous);
  }

  if (input.certificates !== undefined) {
    if (!Array.isArray(input.certificates)) reject('Certificates must be an array');
    const existingIds = new Set(store.certificates.map(item => item.id));
    const submittedExisting = input.certificates.filter(item => existingIds.has(item.id));
    const visibleApplicationIds = new Set(store.applications.filter(item => user.role === 'GATC'
      ? item.assignedGATC === user.name || item.officer === user.name
      : item.assignedLMO === user.name || item.officer === user.name).map(item => item.id));
    const visibleExisting = store.certificates.filter(item => item.issuedBy === user.name || visibleApplicationIds.has(item.applicationId));
    if (!sameRecord(submittedExisting, visibleExisting)) reject('Existing certificates cannot be modified');
    const additions = input.certificates.filter(item => !existingIds.has(item.id));
    for (const certificate of additions) {
      const application = store.applications.find(item => item.id === certificate.applicationId);
      const instrument = application && store.instruments.find(item =>
        item.owner === application.applicant &&
        (item.id === application.instrumentId || item.name === application.instrument));
      const assigned = application && (user.role === 'GATC'
        ? application.assignedGATC === user.name
        : application.assignedLMO === user.name || application.officer === user.name);
      const validDates = !Number.isNaN(new Date(certificate.issuedOn).getTime()) &&
        !Number.isNaN(new Date(certificate.validUntil).getTime()) &&
        new Date(certificate.validUntil).getTime() > Date.now();
      if (!application || !instrument || application.status !== 'Verified' || certificate.issuedBy !== user.name ||
        certificate.applicant !== application.applicant || certificate.instrument !== application.instrument ||
        certificate.instrumentId !== instrument.id || certificate.verificationType !== application.applicationType ||
        certificate.status !== 'Active' || !validDates || !assigned) {
        reject('Certificates require a verified application assigned to the issuing verifier');
      }
    }
    store.certificates = store.certificates
      .filter(item => !visibleExisting.some(visible => visible.id === item.id))
      .concat(input.certificates);
  }
}

function validateAdminCollections(store, input, user) {
  if (input.users !== undefined) {
    if (!Array.isArray(input.users)) reject('Users must be an array');
    const existingAdmins = store.users.filter(item => item.role === 'Admin');
    const submittedAdmins = input.users.filter(item => item.role === 'Admin');
    if (existingAdmins.length !== submittedAdmins.length || existingAdmins.some(admin => {
      const submitted = submittedAdmins.find(item => item.email === admin.email);
      return !submitted || submitted.name !== admin.name || submitted.status !== admin.status;
    })) reject('Administrator accounts cannot be added, removed, or changed');
    if (input.users.some(item => !['User', 'Officer', 'GATC', 'Admin'].includes(item.role))) reject('Invalid account role');
    store.users = input.users.map(item => {
      const previousEmail = item.originalEmail || item.email;
      const previous = store.users.find(existing => existing.email === previousEmail);
      const { originalEmail, ...safeItem } = item;
      return { ...safeItem, passwordHash: previous?.passwordHash || previous?.password || item.passwordHash };
    });
  }
  if (input.applications !== undefined) {
    if (!Array.isArray(input.applications)) reject('Applications must be an array');
    for (const rawApplication of input.applications) {
      const application = normalizeApplication({ ...rawApplication });
      if (!APPLICATION_TYPES.includes(application.applicationType)) reject('Invalid application type');
      if (application.applicationType === 'FIRST_VERIFICATION' && application.assignedLMO !== 'Unassigned') {
        reject('First verification applications cannot be assigned to an LMO');
      }
      if (application.applicationType === 'RE_VERIFICATION' && !application.gatcRequired && application.assignedGATC !== 'Unassigned') {
        reject('Re-verification applications require LMO approval before GATC assignment');
      }
      if (!WORKFLOW_STATUSES.includes(application.status)) reject('Invalid workflow status');
    }
    store.applications = input.applications.map(application => normalizeApplication({ ...application }));
  }
  for (const key of ['instruments', 'certificates', 'officers', 'enforcementCases', 'settings']) {
    if (input[key] !== undefined) store[key] = input[key];
  }
}

function autoAssignFirstVerifications(store) {
  if (!store.settings.autoAssignment) return;

  const gatcs = store.officers.filter(officer =>
    officer.role === 'GATC' && officer.status === 'Active'
  );
  if (!gatcs.length) return;

  const assignedCount = name => store.applications.filter(application =>
    application.assignedGATC === name &&
    !['Verified', 'Verification Rejected', 'Application Rejected', 'Completed'].includes(application.status)
  ).length;

  store.applications.forEach(application => {
    if (application.applicationType !== 'FIRST_VERIFICATION' ||
        application.assignedGATC !== 'Unassigned' ||
        application.status !== 'Application Submitted') return;

    const verifier = [...gatcs].sort((left, right) => assignedCount(left.name) - assignedCount(right.name))[0];
    application.assignedGATC = verifier.name;
    application.officer = verifier.name;
    application.status = 'GATC Assigned';
    application.currentStage = 'GATC_ASSIGNED';
  });
}

async function handleApi(request, response, url) {
  if (request.method === 'POST' && url.pathname === '/api/register') {
    const input = await body(request);
    if (input.role !== undefined && !['User', 'Officer', 'GATC'].includes(input.role)) {
      return json(response, 400, { error: 'Choose User, State LMO, or GATC registration' });
    }
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');

    if (name.length < 2 || !email.includes('@') || password.length < 8 ||
        !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return json(response, 400, { error: 'Use a valid name, email, and a password with 8+ characters, uppercase, lowercase, and a number' });
    }

    const store = await ensureStore();
    if (store.users.some(user => user.email.toLowerCase() === email) ||
        store.officerRequests.some(request => request.email.toLowerCase() === email && request.status === 'Pending')) {
      return json(response, 409, { error: 'An account with this email already exists' });
    }

    if (['Officer', 'GATC'].includes(input.role)) {
      const passwordHash = await hashPassword(password);
      store.officerRequests.push({
        id: `OFF/2026/${String(store.officerRequests.length + 1).padStart(4, '0')}`,
        name,
        email,
        role: input.role,
        passwordHash,
        submittedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'Pending'
      });
      await saveStore(store);
      return json(response, 202, { pending: true, message: 'Officer registration submitted for Admin review' });
    }

    const newUser = { name, email, passwordHash: await hashPassword(password), role: 'User', status: 'Active' };
    store.users.push(newUser);
    await saveStore(store);

    const sessionUser = { name, email, role: 'User' };
    const token = createSession(sessionUser);
    response.setHeader('Set-Cookie', sessionCookie(token));
    return json(response, 201, { user: sessionUser, data: publicStore(store, sessionUser) });
  }

  if (request.method === 'POST' && url.pathname === '/api/login') {
    const input = await body(request);
    const store = await ensureStore();
    const user = store.users.find(item => item.email.toLowerCase() === String(input.email || '').toLowerCase() && item.role === input.role);
    if (!user || user.status !== 'Active' || !(await verifyPassword(input.password, user.passwordHash || user.password))) {
      return json(response, 401, { error: 'Invalid credentials or inactive account' });
    }
    if (user.password && !user.passwordHash) {
      user.passwordHash = await hashPassword(user.password);
      delete user.password;
      await saveStore(store);
    }
    const sessionUser = { name: user.name, email: user.email, role: user.role };
    const token = createSession(sessionUser);
    response.setHeader('Set-Cookie', sessionCookie(token));
    return json(response, 200, { user: sessionUser, data: publicStore(store, sessionUser) });
  }

  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const token = cookie(request, 'ovs_session');
    if (token) sessions.delete(token);
    response.setHeader('Set-Cookie', 'ovs_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return json(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/api/certificates/') && url.pathname.endsWith('/public')) {
    const id = decodeURIComponent(url.pathname.slice('/api/certificates/'.length, -'/public'.length));
    const store = await ensureStore();
    const certificate = store.certificates.find(item => item.id === id);
    return certificate
      ? json(response, 200, { certificate: publicCertificate(certificate) })
      : json(response, 404, { error: 'Certificate not found' });
  }

  const store = await ensureStore();
  const user = currentUser(request, store);
  if (!user) return json(response, 401, { error: 'Authentication required' });

  if (request.method === 'PUT' && url.pathname === '/api/profile') {
    const input = await body(request);
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    if (name.length < 2 || !email.includes('@')) return json(response, 400, { error: 'Enter a valid name and email' });
    if (store.users.some(item => item.email !== user.email && item.email.toLowerCase() === email)) {
      return json(response, 409, { error: 'An account with this email already exists' });
    }
    const account = store.users.find(item => item.email === user.email);
    if (!account) return json(response, 404, { error: 'Account not found' });
    const previousName = account.name;
    account.name = name;
    account.email = email;
    store.applications.forEach(item => {
      if (item.applicant === previousName) item.applicant = name;
      if (item.officer === previousName) item.officer = name;
      if (item.assignedLMO === previousName) item.assignedLMO = name;
      if (item.assignedGATC === previousName) item.assignedGATC = name;
      if (item.scheduledBy === previousName) item.scheduledBy = name;
      if (item.inspectedBy === previousName) item.inspectedBy = name;
      if (item.rejectedBy === previousName) item.rejectedBy = name;
    });
    store.instruments.forEach(item => {
      if (item.owner === previousName) item.owner = name;
    });
    store.certificates.forEach(item => {
      if (item.applicant === previousName) item.applicant = name;
      if (item.issuedBy === previousName) item.issuedBy = name;
    });
    const officer = store.officers.find(item => item.name === previousName);
    if (officer) officer.name = name;
    user.name = name;
    user.email = email;
    await saveStore(store);
    return json(response, 200, { user: { name, email, role: user.role }, data: publicStore(store, user) });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/accounts') {
    if (user.role !== 'Admin') return json(response, 403, { error: 'Only the administrator can create staff accounts' });

    const input = await body(request);
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const role = input.role;

    if (role !== 'User') {
      return json(response, 400, { error: 'Officer accounts must be created through the registration review process' });
    }
    if (name.length < 2 || !email.includes('@') || password.length < 8 ||
        !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return json(response, 400, { error: 'Use a valid name, email, and a password with 8+ characters, uppercase, lowercase, and a number' });
    }
    if (store.users.some(existing => existing.email.toLowerCase() === email)) {
      return json(response, 409, { error: 'An account with this email already exists' });
    }

    store.users.push({ name, email, passwordHash: await hashPassword(password), role, status: 'Active' });
    await saveStore(store);
    return json(response, 201, { data: publicStore(store, user) });
  }

  if (request.method === 'POST' && url.pathname.startsWith('/api/admin/officer-requests/')) {
    if (user.role !== 'Admin') return json(response, 403, { error: 'Only the administrator can review Officer registrations' });
    const requestId = decodeURIComponent(url.pathname.slice('/api/admin/officer-requests/'.length));
    const input = await body(request);
    const officerRequest = store.officerRequests.find(item => item.id === requestId);
    if (!officerRequest || officerRequest.status !== 'Pending') return json(response, 404, { error: 'Pending Officer request not found' });
    if (!['Accept', 'Reject'].includes(input.decision)) return json(response, 400, { error: 'Choose Accept or Reject' });

    officerRequest.status = input.decision === 'Accept' ? 'Accepted' : 'Rejected';
    officerRequest.reviewedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    officerRequest.reviewedBy = user.name;
    if (input.decision === 'Accept') {
      const verifierRole = officerRequest.role || 'Officer';
      store.users.push({ name: officerRequest.name, email: officerRequest.email, passwordHash: officerRequest.passwordHash, role: verifierRole, status: 'Active' });
      store.officers.push({ name: officerRequest.name, email: officerRequest.email, role: verifierRole, assigned: 0, status: 'Active' });
    }
    await saveStore(store);
    return json(response, 200, { data: publicStore(store, user) });
  }

  if (request.method === 'POST' && url.pathname === '/api/complaints') {
    if (!['Officer', 'GATC'].includes(user.role)) return json(response, 403, { error: 'Only LMOs and GATCs can file complaints' });
    const input = await body(request);
    const application = store.applications.find(item => item.id === input.applicationId &&
      (item.officer === user.name || item.assignedLMO === user.name || item.assignedGATC === user.name));
    const action = String(input.action || '').trim();
    const notes = String(input.notes || '').trim();
    if (!application) return json(response, 404, { error: 'Assigned application not found' });
    if (!action || !notes) return json(response, 400, { error: 'Complaint action and evidence notes are required' });
    const duplicate = store.enforcementCases.some(item => item.applicationId === application.id && item.status === 'Pending Admin Decision');
    if (duplicate) return json(response, 409, { error: 'This application already has a complaint awaiting decision' });
    store.enforcementCases.push({
      id: `CMP/2026/${String(store.enforcementCases.length + 1).padStart(4, '0')}`,
      applicationId: application.id,
      owner: application.applicant,
      instrument: application.instrument,
      jurisdiction: application.location,
      action,
      notes,
      status: 'Pending Admin Decision',
      openedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      openedBy: user.name,
      officerRole: user.role
    });
    await saveStore(store);
    return json(response, 201, { message: 'Complaint submitted for Administrator decision' });
  }

  if (request.method === 'POST' && url.pathname.startsWith('/api/admin/complaints/')) {
    if (user.role !== 'Admin') return json(response, 403, { error: 'Only the administrator can decide complaints' });
    const complaintId = decodeURIComponent(url.pathname.slice('/api/admin/complaints/'.length));
    const input = await body(request);
    const complaint = store.enforcementCases.find(item => item.id === complaintId);
    if (!complaint || complaint.status !== 'Pending Admin Decision') return json(response, 404, { error: 'Pending complaint not found' });
    if (!['Suspend', 'Ban', 'Reject'].includes(input.decision)) return json(response, 400, { error: 'Choose Suspend, Ban, or Reject' });

    complaint.status = input.decision === 'Reject' ? 'Rejected' : `Owner ${input.decision === 'Suspend' ? 'Suspended' : 'Banned'}`;
    complaint.decision = input.decision;
    complaint.decidedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    complaint.decidedBy = user.name;
    if (input.decision !== 'Reject') {
      const owner = store.users.find(item => item.name === complaint.owner && item.role === 'User');
      if (!owner) return json(response, 404, { error: 'Instrument owner account not found' });
      owner.status = input.decision === 'Ban' ? 'Banned' : 'Suspended';
    }
    await saveStore(store);
    return json(response, 200, { data: publicStore(store, user) });
  }

  if (request.method === 'GET' && url.pathname === '/api/bootstrap') return json(response, 200, { user, data: publicStore(store, user) });
  if (request.method === 'PUT' && url.pathname === '/api/state') {
    const input = await body(request);
    const mutation = stateMutationQueue.then(async () => {
      const latestStore = await ensureStore();
      const latestUser = currentUser(request, latestStore);
      if (!latestUser) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
      }
      if (latestUser.role === 'Admin') validateAdminCollections(latestStore, input, latestUser);
      else if (['Officer', 'GATC'].includes(latestUser.role)) validateOfficerCollections(latestStore, input, latestUser);
      else validateUserCollections(latestStore, input, latestUser);
      if (latestUser.role === 'User') autoAssignFirstVerifications(latestStore);
      await saveStore(latestStore);
      return { data: publicStore(latestStore, latestUser) };
    });
    stateMutationQueue = mutation.catch(() => {});
    try {
      return json(response, 200, await mutation);
    } catch (error) {
      return json(response, error.statusCode || 400, { error: error.message });
    }
  }
  if (request.method === 'GET' && url.pathname.startsWith('/api/certificates/')) {
    const id = decodeURIComponent(url.pathname.slice('/api/certificates/'.length));
    const certificate = store.certificates.find(item => item.id === id);
    return certificate ? json(response, 200, { certificate }) : json(response, 404, { error: 'Certificate not found' });
  }
  return json(response, 404, { error: 'API route not found' });
}

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
async function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(ROOT, `.${requested}`);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) return json(response, 403, { error: 'Forbidden' });
  try {
    response.writeHead(200, { 'Content-Type': `${mime[path.extname(file)] || 'application/octet-stream'}; charset=utf-8` });
    response.end(await fs.readFile(file));
  } catch { json(response, 404, { error: 'Not found' }); }
}

http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try { if (url.pathname.startsWith('/api/')) await handleApi(request, response, url); else await serveStatic(response, url.pathname); }
  catch (error) { json(response, response.headersSent ? 500 : 400, { error: error.message }); }
}).listen(PORT, () => console.log(`OVS-WM server running at http://localhost:${PORT}`));