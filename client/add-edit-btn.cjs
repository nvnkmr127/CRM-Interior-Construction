const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<div className={styles.controls}>
          <Select 
            value={filters.date} 
            onChange={(e) => setFilters(prev => ({...prev, date: e.target.value}))}
            options={DATE_RANGES}
          />
        </div>`;

const replace = `<div className={styles.controls}>
          {!isEditMode && (
            <button className={styles.rangePillActive} onClick={() => setIsEditMode(true)}>
              Edit Dashboard
            </button>
          )}
          <Select 
            value={filters.date} 
            onChange={(e) => setFilters(prev => ({...prev, date: e.target.value}))}
            options={DATE_RANGES}
          />
        </div>`;

if (content.includes(target)) {
  content = content.replace(target, replace);
  fs.writeFileSync(file, content);
  console.log('Added Edit Dashboard button');
} else {
  console.log('Target not found');
}
