const fs = require('fs');
let c = fs.readFileSync('client/src/pages/config/RolesManager.jsx', 'utf8');

// 1. Fix the Header Classes
c = c.replace('className={layoutStyles.configHeader}', 'className={layoutStyles.sectionHeader}');
c = c.replace('className={layoutStyles.configTitle}', 'className={layoutStyles.sectionTitle}');
c = c.replace('className={layoutStyles.configSubtitle}', 'className={layoutStyles.sectionDesc}');

// 2. Fix the Actions Column
const oldActionsRender = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(r)}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={() => { setCloneSource({ id: r.id, isTemplate: false, name: r.name }); setCloneName(\`\${r.name} - Copy\`); setIsCloneModalOpen(true); }}>Duplicate</Button>
          <Button variant="ghost" size="sm" onClick={() => handleSaveAsTemplate(r)}>Save as Template</Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenVersionModal(r)}>Version History</Button>
          <Button variant="ghost" size="sm" onClick={() => handleOpenAuditModal(r)}>Audit History</Button>
          {r.name !== 'superadmin' && r.name !== 'Super Admin' && (
            <Button variant="danger" size="sm" onClick={() => handleDeleteRole(r.id)}>Delete</Button>
          )}
        </div>`;

const newActionsRender = `<div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => handleOpenModal(r)}>Edit</Button>
          
          <div className={styles.dropdown} style={{ position: 'relative', display: 'inline-block' }}>
            <button className={styles.ellipsisBtn} style={{ background: 'none', border: '1px solid transparent', fontSize: '18px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', color: 'var(--color-text-muted)' }}>⋮</button>
            <div className={styles.dropdownContent} style={{ display: 'none', position: 'absolute', right: 0, top: '100%', backgroundColor: 'var(--color-surface)', minWidth: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: '6px', border: '1px solid var(--color-border)', zIndex: 50, overflow: 'hidden' }}>
              
              <style dangerouslySetInnerHTML={{__html: \`
                .\${styles.dropdown}:hover .\${styles.dropdownContent} { display: block !important; }
                .\${styles.dropdownContent} button { width: 100%; text-align: left; background: none; border: none; padding: 10px 16px; font-size: 13px; cursor: pointer; color: var(--color-text); transition: background 0.1s; }
                .\${styles.dropdownContent} button:hover { background: var(--color-bg-hover); }
                .\${styles.dropdownContent} button.deleteBtn { color: #dc2626; }
                .\${styles.dropdownContent} button.deleteBtn:hover { background: rgba(239, 68, 68, 0.05); }
              \`}} />

              <button onClick={() => { setCloneSource({ id: r.id, isTemplate: false, name: r.name }); setCloneName(\`\${r.name} - Copy\`); setIsCloneModalOpen(true); }}>Duplicate Role</button>
              <button onClick={() => handleSaveAsTemplate(r)}>Save as Template</button>
              <button onClick={() => handleOpenVersionModal(r)}>Version History</button>
              <button onClick={() => handleOpenAuditModal(r)}>Audit History</button>
              
              {r.name !== 'superadmin' && r.name !== 'Super Admin' && (
                <button className="deleteBtn" onClick={() => handleDeleteRole(r.id)}>Delete Role</button>
              )}
            </div>
          </div>
        </div>`;

c = c.replace(oldActionsRender, newActionsRender);

fs.writeFileSync('client/src/pages/config/RolesManager.jsx', c);
console.log('Fixed UI in RolesManager');
