const pool = require('../config/db');

class LabourAttendanceRepository {
  async checkInWorker(tenantId, projectId, data) {
    const {
      worker_name,
      trade,
      vendor_id,
      contractor_name,
      work_assigned,
      attendance_method = 'manual'
    } = data;

    const query = `
      INSERT INTO labour_attendance (
        tenant_id, project_id, worker_name, trade, vendor_id, contractor_name, work_assigned, attendance_method
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      tenantId,
      projectId,
      worker_name,
      trade,
      vendor_id || null,
      contractor_name || null,
      work_assigned || null,
      attendance_method
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async checkOutWorker(tenantId, attendanceId, checkOutTime = new Date().toISOString()) {
    const query = `
      UPDATE labour_attendance
      SET check_out_time = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const { rows } = await pool.query(query, [checkOutTime, attendanceId, tenantId]);
    return rows[0];
  }

  async findAttendanceByProject(tenantId, projectId) {
    const query = `
      SELECT a.*, v.vendor_name as linked_vendor_name
      FROM labour_attendance a
      LEFT JOIN project_vendors v ON a.vendor_id = v.id
      WHERE a.tenant_id = $1 AND a.project_id = $2
      ORDER BY a.check_in_time DESC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }
}

module.exports = new LabourAttendanceRepository();
