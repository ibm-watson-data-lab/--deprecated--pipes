- view: lead
  sql_table_name: '"sf_lead"'
  fields:

  - dimension: id
    primary_key: true
    sql: ${TABLE}."Id"

  - dimension: _id
    sql: ${TABLE}."_id"

#   - dimension: _rev
#     sql: ${TABLE}."_rev"

  - dimension: address_country
    sql: ${TABLE}."Address_country"

#   - dimension: attributes_type
#     sql: ${TABLE}."attributes_type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

  - dimension: company
    sql: ${TABLE}."Company"

  - dimension: converted_account_id
    sql: ${TABLE}."ConvertedAccountId"

  - dimension: converted_contact_id
    sql: ${TABLE}."ConvertedContactId"

  - dimension: converted
    sql: ${TABLE}."ConvertedDate"
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."ConvertedDate",1,10) || ' ' || substring(${TABLE}."ConvertedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: converted_opportunity_id
    sql: ${TABLE}."ConvertedOpportunityId"

  - dimension: country
    sql: ${TABLE}."Country"

  - dimension: created_by_id
    sql: ${TABLE}."CreatedById"

  - dimension: created
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: created_vs_handoff
    sql: ${TABLE}."Created_vs_Handoff__c"

  - dimension: email
    sql: ${TABLE}."Email"

  - dimension: first_name
    sql: ${TABLE}."FirstName"

  - dimension: geo_2
    sql: ${TABLE}."Geo_2__c"

  - dimension: geo
    sql: ${TABLE}."Geo__c"

  - dimension: has_opted_out_of_email
    type: int
    sql: ${TABLE}."HasOptedOutOfEmail"

  - dimension: is_converted
    type: int
    sql: ${TABLE}."IsConverted"

  - dimension: is_deleted
    type: int
    sql: ${TABLE}."IsDeleted"

  - dimension: is_unread_by_owner
    type: int
    sql: ${TABLE}."IsUnreadByOwner"
  
  - dimension: last_modified_by_id
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: last_name
    sql: ${TABLE}."LastName"

  - dimension: lead_source
    sql: ${TABLE}."LeadSource"

  - dimension: milestone_reporting_db
    type: number
    sql: ${TABLE}."Milestone_Reporting_DB__c"

  - dimension: milestone_reporting_docs
    type: number
    sql: ${TABLE}."Milestone_Reporting_Docs__c"

  - dimension: milestone_reporting_funnel_rpt
    sql: ${TABLE}."Milestone_Reporting_Funnel_Rpt__c"

  - dimension: milestone_reporting_funnel_sort
    type: number
    sql: ${TABLE}."Milestone_Reporting_Funnel_Sort__c"

  - dimension: milestone_reporting_view
    type: number
    sql: ${TABLE}."Milestone_Reporting_View__c"

  - dimension: name
    sql: ${TABLE}."Name"

  - dimension: owner_id
    sql: ${TABLE}."OwnerId"

  - dimension: pt_type
    sql: ${TABLE}."pt_type"

  - dimension: sales_connect_opp_number
    sql: ${TABLE}."Sales_connect_OppNumber__c"

  - dimension: source_group
    sql: ${TABLE}."Source_Group__c"

  - dimension: status
    sql: ${TABLE}."Status"

  - dimension: system_modstamp
    sql: ${TABLE}."SystemModstamp"

  - dimension: time_to_opportunity
    type: number
    sql: ${TABLE}."TimeToOpportunity__c"

  - dimension: title
    sql: ${TABLE}."Title"

  - dimension: user_agent
    type: int
    sql: ${TABLE}."User_Agent__c"

  - measure: count
    type: count
    drill_fields: [id, first_name, last_name, name]

