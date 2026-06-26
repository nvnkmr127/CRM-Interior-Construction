-- Migration: 092_trade_work_activities.sql
-- Description: Creates trade work activity templates and project work activity tracking tables.

-- 1. Create trade activity templates table
CREATE TABLE IF NOT EXISTS trade_activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade VARCHAR(50) NOT NULL, -- civil, electrical, plumbing, false_ceiling, flooring, painting, carpentry, glass, soft_furnishing
  room_type VARCHAR(50) NOT NULL DEFAULT 'General', -- General, Kitchen, Bedroom, Bathroom, Living Room
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create project work activities table
CREATE TABLE IF NOT EXISTS project_work_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES project_phases(id) ON DELETE SET NULL,
  room_name VARCHAR(100) NOT NULL, -- Room/area of the project, e.g. 'Living Room', 'Master Bedroom'
  trade VARCHAR(50) NOT NULL, -- civil, electrical, plumbing, false_ceiling, flooring, painting, carpentry, glass, soft_furnishing
  activity_name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  due_date DATE,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_proj_work_act_proj ON project_work_activities(project_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_proj_work_act_phase ON project_work_activities(phase_id, tenant_id);

-- 4. Seed default trade-wise activity templates
INSERT INTO trade_activity_templates (trade, room_type, activity_name, description, sort_order) VALUES
-- Civil Templates
('civil', 'General', 'Demolition and hacking', 'Demolition of existing structures, walls, or tiles.', 10),
('civil', 'General', 'Debris removal & site cleaning', 'Clearing out debris and preparing the floor/walls.', 20),
('civil', 'General', 'Brickwork & partition construction', 'Constructing new walls or block partitions.', 30),
('civil', 'General', 'Internal wall plastering', 'Applying cement plaster coat to align walls.', 40),
('civil', 'Bathroom', 'Floor hacking and base leveling', 'Hacking existing floor, readying for plumbing.', 50),
('civil', 'Bathroom', 'Floor screeding and slope check', 'Providing screed bed and checking drainage slope.', 60),

-- Electrical Templates
('electrical', 'General', 'Electrical switch layout marking', 'Marking point positions for sockets, switches, and conduits.', 10),
('electrical', 'General', 'Wall chasing and conduit pipe laying', 'Cutting grooves in walls and fitting PVC conduit pipes.', 20),
('electrical', 'General', 'Concealed metal backbox fixing', 'Fixing metal GI switchboxes in walls.', 30),
('electrical', 'General', 'Wire pulling and cable routing', 'Routing wires through conduits for mains, lighting, and power.', 40),
('electrical', 'General', 'Distribution board & MCB dressing', 'Installing the DB box, MCBs, and dressing connections.', 50),
('electrical', 'General', 'Switchboard modular plates mounting', 'Fixing switches, sockets, and plates to switchboxes.', 60),
('electrical', 'General', 'Light fittings and fans installation', 'Mounting ceiling lights, wall lamps, spot lights, and fans.', 70),

-- Plumbing Templates
('plumbing', 'Bathroom', 'Wall pipe chasing and layout', 'Chasing bathroom walls for hot/cold water pipes.', 10),
('plumbing', 'Bathroom', 'Drainage and waste pipe fitting', 'Laying down drain lines, traps, and waste outlets.', 20),
('plumbing', 'Bathroom', 'Waterproofing base coat application', 'Applying waterproofing compounds on floors and wet walls.', 30),
('plumbing', 'Bathroom', 'Sanitaryware & CP fittings installation', 'Installing water closets, wash basins, showers, and faucets.', 40),
('plumbing', 'Kitchen', 'Sink inlet & outlet pipe connection', 'Connecting kitchen sink pipework and faucet fittings.', 50),

-- False Ceiling Templates
('false_ceiling', 'General', 'Ceiling framing & level marking', 'Marking levels on walls and installing GI steel frame grids.', 10),
('false_ceiling', 'General', 'Gypsum board boarding & fixing', 'Screwing gypsum plasterboards onto the steel frame.', 20),
('false_ceiling', 'General', 'Joint tape compound finish', 'Applying jointing tape and compound over gypsum board joints.', 30),
('false_ceiling', 'General', 'Light & spot cutouts cutting', 'Making circular or square cutouts for lights and LEDs.', 40),

-- Flooring Templates
('flooring', 'General', 'Subfloor cleaning and priming', 'Cleaning dust and applying primer/cement slurry.', 10),
('flooring', 'General', 'Tile / marble laying & leveling', 'Spreading mortar bed and laying tiles/stones with spacers.', 20),
('flooring', 'General', 'Grouting and joint filling', 'Filling tile joints with epoxy or cement grout.', 30),
('flooring', 'General', 'Skirting tile cutting and fixing', 'Fixing wall-border skirting tiles.', 40),
('flooring', 'General', 'Floor protection sheets overlay', 'Laying floor protection sheets to prevent scratch damage.', 50),

-- Painting Templates
('painting', 'General', 'Wall scraping & sanding prep', 'Scraping old paint, wallpaper, and sanding plaster.', 10),
('painting', 'General', 'Wall putty application - Coat 1', 'Applying first base coat of acrylic wall putty.', 20),
('painting', 'General', 'Wall putty & sanding - Coat 2', 'Applying second coat of putty and fine sanding.', 30),
('painting', 'General', 'Wall primer coat application', 'Applying acrylic water-based wall primer.', 40),
('painting', 'General', 'Premium emulsion paint - Coat 1', 'Applying first finish coat of interior emulsion.', 50),
('painting', 'General', 'Premium emulsion paint - Coat 2', 'Applying second/final finish coat of paint.', 60),

-- Carpentry Templates
('carpentry', 'Kitchen', 'Modular base cabinet carcass assembly', 'Assembling and leveling kitchen base modular units.', 10),
('carpentry', 'Kitchen', 'Modular wall cabinet carcass mounting', 'Mounting wall units and adjusting overhead heights.', 20),
('carpentry', 'Bedroom', 'Wardrobe carcass assembly & fixing', 'Assembling bedroom wardrobe framing and shelves.', 30),
('carpentry', 'General', 'Laminate / veneer sheet pressing', 'Applying adhesives and pressing laminates or veneer.', 40),
('carpentry', 'General', 'Shutters hinges & soft-close adjustment', 'Hanging cabinet doors and adjusting auto-hinges.', 50),
('carpentry', 'General', 'Hardware accessories & handles fixing', 'Fixing handles, drawers runners, pullouts, and baskets.', 60),

-- Glass Templates
('glass', 'Bathroom', 'Shower partition template measurement', 'Taking exact template sizes for toughened shower glass.', 10),
('glass', 'Bathroom', 'Shower glass panel installation', 'Fixing U-channel profiles and mounting toughened glass.', 20),
('glass', 'Bathroom', 'Mirror mounting & back-lit wiring', 'Installing dressing and bathroom wall mirrors.', 30),
('glass', 'General', 'Glass shelves & shutters installation', 'Fitting glass shelving and glass cabinet shutters.', 40),

-- Soft Furnishing Templates
('soft_furnishing', 'Living Room', 'Curtain track mounting', 'Installing channel tracks or rods to ceiling/walls.', 10),
('soft_furnishing', 'Bedroom', 'Window blinds / roller blinds installation', 'Mounting bracket system and roller blinds.', 20),
('soft_furnishing', 'General', 'Wallpaper application prep and fixing', 'Sizing wallpaper sheets and gluing them onto walls.', 30);
