const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/src/components/leads/LeadDrawer.jsx');
let content = fs.readFileSync(filePath, 'utf8');

function extractBlock(startMarker, endMarker) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    console.error('Could not find block', startMarker, endMarker);
    process.exit(1);
  }
  return content.substring(start, end);
}

const beforeOverview = content.substring(0, content.indexOf(`{activeTab === 'overview' && (`));
const afterOverview = content.substring(content.indexOf(`{activeTab === 'negotiation' && (`));

// Extract all blocks
const upcomingMeeting = extractBlock(`{/* Upcoming Meeting */}`, `{/* Contact Info */}`);
const contactInfo = extractBlock(`{/* Contact Info */}`, `{/* Property & Scope */}`);
const propertyScope = extractBlock(`{/* Property & Scope */}`, `{/* Preferences & Tracking */}`);

// We need to cut preferences right before the end of left panel div
const prefStart = content.indexOf(`{/* Preferences & Tracking */}`);
const leftPanelEnd = content.indexOf(`{/* END LEFT PANEL */}`);
// find the last </div> before leftPanelEnd
const prefContent = content.substring(prefStart, leftPanelEnd);
const preferences = prefContent.substring(0, prefContent.lastIndexOf('</div>'));

// For center panel, extract from Checklist to END CENTER PANEL
const centerPanelInnerStart = content.indexOf(`<DiscoveryCallChecklist`);
const centerPanelEnd = content.indexOf(`{/* END CENTER PANEL */}`);
const centerContent = content.substring(centerPanelInnerStart, centerPanelEnd);
const checklistAndTimeline = centerContent.substring(0, centerContent.lastIndexOf('</div>'));

// For right panel, extract parts
const scoreStart = content.indexOf(`<LeadQualificationScore`);
const scoreEnd = content.indexOf(`{/* AI Insights Section */}`);
const score = content.substring(scoreStart, scoreEnd);

const aiInsights = extractBlock(`{/* AI Insights Section */}`, `{/* BUYING INTENT WIDGET */}`);
const buyingIntent = extractBlock(`{/* BUYING INTENT WIDGET */}`, `{/* REFERRAL NETWORK WIDGET */}`);

const referralStart = content.indexOf(`{/* REFERRAL NETWORK WIDGET */}`);
const rightPanelEnd = content.indexOf(`{/* END RIGHT PANEL */}`);
const referralContent = content.substring(referralStart, rightPanelEnd);
// it has two divs ending before END RIGHT PANEL
let refStr = referralContent;
refStr = refStr.substring(0, refStr.lastIndexOf('</div>'));
refStr = refStr.substring(0, refStr.lastIndexOf('</div>'));
const referralNetwork = refStr;

// Assemble new overview tab
const newOverview = `{activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* COLUMN 1: Data Entry & Details */}
                <div className="space-y-6 flex flex-col">
                  ${contactInfo.trim()}
                  
                  ${propertyScope.trim()}
                  
                  ${preferences.trim()}
                </div>
                
                {/* COLUMN 2: AI & Insights */}
                <div className="space-y-6 flex flex-col md:border-l md:border-gray-100 md:pl-6 xl:border-l-0 xl:pl-0">
                  ${score.trim()}
                  
                  ${upcomingMeeting.trim()}
                  
                  ${aiInsights.trim()}
                  
                  ${buyingIntent.trim()}
                  
                  ${referralNetwork.trim()}
                </div>
                
                {/* COLUMN 3: Timeline & Checklist */}
                <div className="space-y-4 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-gray-100 xl:pl-6">
                  ${checklistAndTimeline.trim()}
                </div>
              </div>
            )}
            
            `;

fs.writeFileSync(filePath, beforeOverview + newOverview + afterOverview);
console.log("Successfully reorganized LeadDrawer layout.");
