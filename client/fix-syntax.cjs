const fs = require('fs');
const file = 'd:/Digicloudify softwares/CRM-Interior-Construction/client/src/pages/analytics/LeadAnalyticsPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'`;

const replaceStr = `import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync(file, content);
console.log('Fixed syntax error');
