const fs = require('fs');
let content = fs.readFileSync('src/routes/org.js', 'utf8');

const replacement = `if (parent_id === id) return fail(res, 'VALIDATION_ERROR', 'Cannot set parent to self', 400);

    if (parent_id) {
      const { rows: tree } = await pool.query(\`
        WITH RECURSIVE check_tree AS (
          SELECT id, parent_id FROM \${req.route.path.includes('departments') ? 'departments' : 'branches'} WHERE id = $1
          UNION ALL
          SELECT t.id, t.parent_id FROM \${req.route.path.includes('departments') ? 'departments' : 'branches'} t
          INNER JOIN check_tree ct ON ct.parent_id = t.id
        )
        SELECT id FROM check_tree
      \`, [parent_id]);
      if (tree.some(node => node.id === id)) return fail(res, 'VALIDATION_ERROR', 'Circular structure detected', 400);
    }

    const updates = [];
    const params = [id, tenantId];`;

content = content.replace(/if \(parent_id === id\) return fail\(res, 'VALIDATION_ERROR', 'Cannot set parent to self', 400\);\s*const updates = \[\];\s*const params = \[id, tenantId\];/g, replacement);

fs.writeFileSync('src/routes/org.js', content);
