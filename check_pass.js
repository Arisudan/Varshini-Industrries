const bcrypt = require('bcryptjs');
const hash = '$2b$10$YhN57M3Y5edOy5ZjqdWuF.fMGFw1Phu6y8q9A5zhHP/uac1kgO3Qm';
const pass = 'admin123';
console.log('Match:', bcrypt.compareSync(pass, hash));
