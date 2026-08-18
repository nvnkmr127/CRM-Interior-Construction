const { convertToProject } = require('./services/leads/convertToProject');
const pool = require('./config/db');

async function test() {
  try {
    console.log('Testing convertToProject...');
    // Replace with realistic tenantId and userId if known, or mock ones
    const result = await convertToProject('d6899b8d-3388-4444-933e-e61895a9e3a6', '00000000-0000-0000-0000-000000000000', '302bc056-da06-4a59-9968-f2e5c9496603', {
      projectName: 'Test Project',
      projectType: 'residential',
      contract_file_key: 'blob:http://localhost:5173/abcd',
      contract_file_name: 'test.pdf',
      contract_file_size: 1000,
      contract_file_mime: 'application/pdf',
      advanceAmount: 10000
    });
    console.log('Success:', result);
  } catch (err) {
    console.error('ERROR CATCHED:', err.stack || err);
  } finally {
    pool.end();
  }
}
test();
