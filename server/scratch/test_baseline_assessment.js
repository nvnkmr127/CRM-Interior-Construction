require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');
const baselineAssessmentRepository = require('../src/repositories/baselineAssessmentRepository');

async function test() {
  try {
    // 1. Get tenant and user
    const tenantRes = await pool.query('SELECT id FROM tenants LIMIT 1');
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');

    if (tenantRes.rows.length === 0 || userRes.rows.length === 0) {
      console.error('Missing tenants or users in the database to run the test.');
      return;
    }

    const tenantId = tenantRes.rows[0].id;
    const userId = userRes.rows[0].id;

    // 2. Create a temporary project to associate with the assessment
    console.log('Creating a mock project for test...');
    const projectRes = await pool.query(`
      INSERT INTO projects (tenant_id, name, client_name, status)
      VALUES ($1, 'Baseline Test Project', 'Client Baseline', 'active')
      RETURNING id
    `, [tenantId]);
    const projectId = projectRes.rows[0].id;
    console.log('Mock project created with ID:', projectId);

    // 3. Test saveAssessment (Insert)
    console.log('Testing saveAssessment (Insert)...');
    const assessmentData = {
      overall_notes: 'Overall site has minor wall cracks and plumbing checks failed in kitchen.',
      video_walkthrough_url: 'https://youtube.com/walkthrough-site',
      items: [
        {
          room_name: 'Kitchen',
          area_checked: 'plumbing',
          condition_status: 'defect',
          notes: 'Water leakage in inlet pipe.',
          photos: ['http://example.com/leak1.jpg', 'http://example.com/leak2.jpg']
        },
        {
          room_name: 'Living Room',
          area_checked: 'walls',
          condition_status: 'damaged',
          notes: 'Hairline cracks in plaster near balcony door.',
          photos: []
        }
      ]
    };

    const saved = await baselineAssessmentRepository.saveAssessment(
      tenantId,
      projectId,
      userId,
      assessmentData
    );
    console.log('Assessment saved successfully with ID:', saved.id);

    // 4. Test findAssessment
    console.log('Testing findAssessment...');
    let fetched = await baselineAssessmentRepository.findAssessment(tenantId, projectId);
    console.log('Fetched overall notes:', fetched.overall_notes);
    console.log('Fetched video url:', fetched.video_walkthrough_url);
    console.log('Fetched items length:', fetched.items.length);
    console.log('Item 0 room:', fetched.items[0]?.room_name);
    console.log('Item 0 status:', fetched.items[0]?.condition_status);

    if (
      fetched.overall_notes !== 'Overall site has minor wall cracks and plumbing checks failed in kitchen.' ||
      fetched.video_walkthrough_url !== 'https://youtube.com/walkthrough-site' ||
      fetched.items.length !== 2 ||
      fetched.items[0]?.condition_status !== 'defect' ||
      fetched.items[1]?.condition_status !== 'damaged'
    ) {
      throw new Error('Assertions failed during creation!');
    }
    console.log('Creation assertions passed.');

    // 5. Test saveAssessment (Update)
    console.log('Testing saveAssessment (Update)...');
    const updateData = {
      overall_notes: 'Updated overall notes.',
      video_walkthrough_url: 'https://youtube.com/walkthrough-site-updated',
      items: [
        {
          room_name: 'Kitchen',
          area_checked: 'plumbing',
          condition_status: 'ok',
          notes: 'Leak fixed by builder.',
          photos: []
        }
      ]
    };

    await baselineAssessmentRepository.saveAssessment(
      tenantId,
      projectId,
      userId,
      updateData
    );
    console.log('Assessment updated successfully.');

    fetched = await baselineAssessmentRepository.findAssessment(tenantId, projectId);
    console.log('Fetched updated overall notes:', fetched.overall_notes);
    console.log('Fetched updated items length:', fetched.items.length);
    console.log('Updated item 0 status:', fetched.items[0]?.condition_status);

    if (
      fetched.overall_notes !== 'Updated overall notes.' ||
      fetched.video_walkthrough_url !== 'https://youtube.com/walkthrough-site-updated' ||
      fetched.items.length !== 1 ||
      fetched.items[0]?.condition_status !== 'ok'
    ) {
      throw new Error('Assertions failed during update!');
    }
    console.log('Update assertions passed.');

    // 6. Clean up project (will cascade delete assessment and items)
    console.log('Cleaning up mock project...');
    await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
    console.log('Cleaned up. Test completed successfully!');

  } catch (err) {
    console.error('Test failed with error:', err);
  } finally {
    await pool.end();
  }
}

test();
