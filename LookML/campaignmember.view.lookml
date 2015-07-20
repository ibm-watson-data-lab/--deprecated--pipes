- view: campaign_member
  sql_table_name: '"sf_campaignmember"'
  fields:

  - dimension: id
    primary_key: true
    sql: ${TABLE}."Id"

  - dimension: _id
    sql: ${TABLE}."_id"

#   - dimension: _rev
#     sql: ${TABLE}."_rev"

  - dimension: attributes_type
    sql: ${TABLE}."attributes_type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

  - dimension: campaign_id
    sql: ${TABLE}."CampaignId"

  - dimension: created_by_id
    sql: ${TABLE}."CreatedById"

  - dimension: created
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: first_responded
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."FirstRespondedDate",1,10) || ' ' || substring(${TABLE}."FirstRespondedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: geo
    sql: ${TABLE}."Geo__c"

  - dimension: has_responded
    type: int
    sql: ${TABLE}."HasResponded"

  - dimension: is_deleted
    type: int
    sql: ${TABLE}."IsDeleted"

  - dimension: last_modified_by_id
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 


  - dimension: lead_id
    sql: ${TABLE}."LeadId"

  - dimension: net_new
    sql: ${TABLE}."Net_New__c"

  - dimension: prospect_status
    sql: ${TABLE}."Prospect_Status__c"

  - dimension: pt_type
    sql: ${TABLE}."pt_type"

  - dimension: status
    sql: ${TABLE}."Status"

  - dimension: system_modstamp
    sql: ${TABLE}."SystemModstamp"

  - measure: count
    type: count
    drill_fields: [id]

