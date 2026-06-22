-- Seed comprehensive automation rules (Items 1-13)

DO $$
DECLARE
    v_tenant_id UUID;
    v_sys_user_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
    SELECT id INTO v_sys_user_id FROM users WHERE email = 'admin@demo.com' AND tenant_id = v_tenant_id LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
        DELETE FROM automation_rules WHERE tenant_id = v_tenant_id;

        -- 1. Lead Capture Automation
        -- Rule 1.1: General Lead Setup (Welcome WhatsApp, Assignment if not VIP)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.1 General Lead Setup', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "budget", "operator": "lt", "value": "2500000", "logic": "OR"}, {"field": "budget", "operator": "is_empty", "logic": "OR"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "round_robin"}},
                {"type": "send_whatsapp", "config": {"templateId": "general_welcome"}},
                {"type": "create_task", "config": {"title": "Initial Contact", "dueInHours": 24}}
            ]', v_sys_user_id
        );

        -- Rule 1.2: VIP Lead Setup
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.2 VIP Lead Setup', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "budget", "operator": "gt", "value": "2499999", "logic": "AND"}]',
            '[
                {"type": "update_field", "config": {"field": "is_vip", "value": true}},
                {"type": "assign_user", "config": {"strategy": "senior_rep"}},
                {"type": "create_task", "config": {"title": "Call VIP Lead immediately", "dueInHours": 1}},
                {"type": "invoke_ai", "config": {"actionType": "generate_summary", "outputField": "ai_summary"}},
                {"type": "send_whatsapp", "config": {"templateId": "vip_welcome"}}
            ]', v_sys_user_id
        );

        -- Rule 1.3: Repeat Customer
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '1.3 Repeat Customer Mapping', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "customer_type", "operator": "eq", "value": "repeat", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Welcome back repeat customer", "dueInHours": 24}}]', v_sys_user_id
        );

        -- 2. Lead Assignment
        -- Rule 2.1: Territory Routing (Bangalore)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '2.1 Bangalore Territory Assignment', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "city", "operator": "eq", "value": "Bangalore", "logic": "AND"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "round_robin"}},
                {"type": "create_task", "config": {"title": "Welcome Local Lead", "dueInHours": 12}}
            ]', v_sys_user_id
        );

        -- 3. Follow-up Escalations
        -- Rule 3.1: 24h Reminder
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.1 24hr Reminder', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 24}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Reminder: Contact Lead", "dueInHours": 4}}]', v_sys_user_id
        );

        -- Rule 3.2: 48h Manager Alert
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.2 48hr No Contact Manager Alert', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 48}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[{"type": "create_task", "config": {"title": "Escalation: Lead untouched 48 hrs", "assignToRole": "sales_manager"}}]', v_sys_user_id
        );

        -- Rule 3.3: 72h Escalation/Reassignment
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.3 72hr Reassignment', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 72}}',
            '[{"field": "first_contacted_at", "operator": "is_empty", "logic": "AND"}]',
            '[
                {"type": "assign_user", "config": {"strategy": "reassign_round_robin"}},
                {"type": "create_task", "config": {"title": "Reassigned Lead: Contact ASAP", "dueInHours": 2}}
            ]', v_sys_user_id
        );

        -- Rule 3.4: Missed Follow-up (Simulated via Date Condition on Lead)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '3.4 Missed Follow-up Score Penalty', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "next_followup_date", "offsetHours": 24}}',
            '[{"field": "status", "operator": "eq", "value": "open", "logic": "AND"}]',
            '[
                {"type": "update_field", "config": {"field": "score", "value": -10, "relative": true}},
                {"type": "create_task", "config": {"title": "Overdue Follow-up! Score Penalized", "assignToRole": "sales_manager"}}
            ]', v_sys_user_id
        );

        -- 4. Communication Automation
        -- Rule 4.1: Quote Expiry
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '4.1 Quote Expiry Reminder', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "proposal_sent_at", "offsetHours": 72}}',
            '[{"field": "stage", "operator": "eq", "value": "proposal_sent", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "quote_followup"}}]', v_sys_user_id
        );

        -- 5. Activity Automation
        -- Rule 5.1: Phone Call Logged -> AI Summary
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '5.1 Phone Call Logged', '{"type": "activity_logged", "entity": "lead"}',
            '[{"field": "activity_type", "operator": "eq", "value": "call", "logic": "AND"}]',
            '[{"type": "invoke_ai", "config": {"actionType": "extract_action_items"}}]', v_sys_user_id
        );

        -- Rule 5.2: Meeting Logged
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '5.2 Post-Meeting Processing', '{"type": "activity_logged", "entity": "lead"}',
            '[{"field": "activity_type", "operator": "eq", "value": "meeting", "logic": "AND"}]',
            '[
                {"type": "invoke_ai", "config": {"actionType": "extract_action_items"}},
                {"type": "create_task", "config": {"title": "Post-meeting follow up", "dueInHours": 48}}
            ]', v_sys_user_id
        );

        -- 6. Site Visit Automation
        -- Rule 6.1: Site Visit Scheduled
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '6.1 Site Visit Scheduled', '{"type": "field.changed", "entity": "lead", "config": {"field": "site_visit_date"}}',
            '[{"field": "site_visit_date", "operator": "is_not_empty", "logic": "AND"}]',
            '[
                {"type": "send_calendar_invite", "config": {"eventTitle": "Site Visit", "eventDatePath": "site_visit_date"}},
                {"type": "send_whatsapp", "config": {"templateId": "visit_reminder"}},
                {"type": "create_task", "config": {"title": "Prepare visit checklist", "dueInHours": 2}}
            ]', v_sys_user_id
        );

        -- 7. Quotation Automation
        -- Rule 7.1: Quote Generated
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '7.1 Quote Generated', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "proposal_generated", "logic": "AND"}]',
            '[
                {"type": "send_whatsapp", "config": {"templateId": "quote_ready"}},
                {"type": "create_task", "config": {"title": "Review quote with customer", "dueInHours": 24}}
            ]', v_sys_user_id
        );

        -- Rule 7.2: Quote Accepted
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '7.2 Quote Accepted', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "quote_accepted", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Process Booking & Collect Advance", "dueInHours": 24}},
                {"type": "create_task", "config": {"title": "Approve Finance / Notify Accounts", "assignToRole": "admin"}}
            ]', v_sys_user_id
        );

        -- 8. Stage Automation
        -- Rule 8.1: Site Visit Completed -> Move to Measurement
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '8.1 Post Site Visit / Measurement', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "site_visit_completed", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Complete Measurements", "dueInHours": 48}},
                {"type": "send_whatsapp", "config": {"templateId": "thank_you_visit"}}
            ]', v_sys_user_id
        );

        -- 9. AI Automation
        -- Rule 9.1: Lost Opportunity AI Review
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '9.1 AI Win-Back Analysis', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "lost", "logic": "AND"}]',
            '[{"type": "invoke_ai", "config": {"actionType": "win_back_analysis"}}]', v_sys_user_id
        );

        -- 10. Manager Notifications (Lead Aging 30 days)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '10.1 Lead Aging 30 Days', '{"type": "date.condition", "entity": "lead", "config": {"dateField": "created_at", "offsetHours": 720}}',
            '[{"field": "stage", "operator": "eq", "value": "new", "logic": "AND"}]',
            '[
                {"type": "invoke_ai", "config": {"actionType": "diagnose_delay"}},
                {"type": "create_task", "config": {"title": "Lead aged > 30 days. Review required.", "assignToRole": "sales_manager"}}
            ]', v_sys_user_id
        );

        -- 11. Operations Automation
        -- Rule 11.1: Advance Received -> Project Handover
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '11.1 Project Handover', '{"type": "field.changed", "entity": "lead", "config": {"field": "stage"}}',
            '[{"field": "stage", "operator": "eq", "value": "advance_received", "logic": "AND"}]',
            '[
                {"type": "create_project", "config": {}},
                {"type": "send_email", "config": {"templateId": "welcome_journey"}}
            ]', v_sys_user_id
        );

        -- 12. Customer Experience
        -- Rule 12.1: Post Handover Survey
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '12.1 Post-Project Survey', '{"type": "field.changed", "entity": "project", "config": {"field": "status"}}',
            '[{"field": "status", "operator": "eq", "value": "handed_over", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "csat_survey"}}]', v_sys_user_id
        );

        -- 13. Referral Management
        -- Rule 13.1: Happy Customer (NPS > 8)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '13.1 Referral Request', '{"type": "field.changed", "entity": "project", "config": {"field": "nps_score"}}',
            '[{"field": "nps_score", "operator": "gt", "value": "8", "logic": "AND"}]',
            '[{"type": "send_whatsapp", "config": {"templateId": "referral_request"}}]', v_sys_user_id
        );

        -- Rule 13.2: Referral Received (New Lead created with referral source)
        INSERT INTO automation_rules (tenant_id, name, trigger, conditions, actions, created_by)
        VALUES (
            v_tenant_id, '13.2 Referral Reward Notify', '{"type": "lead_created", "entity": "lead"}',
            '[{"field": "referral_source", "operator": "is_not_empty", "logic": "AND"}]',
            '[
                {"type": "create_task", "config": {"title": "Send Referral Reward to Referrer", "dueInHours": 48}}
            ]', v_sys_user_id
        );

    END IF;
END $$;
