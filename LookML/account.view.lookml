- view: account
  sql_table_name: '"sf_account"'
  fields:

  - dimension: id
    primary_key: true
    sql: ${TABLE}."Id"

#   - dimension: _id
#     sql: ${TABLE}."_id"

  - dimension: _rev
    sql: ${TABLE}."_rev"

#   - dimension: attributes_type
#     sql: ${TABLE}."attributes_type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

#   - dimension: billing_address_country
#     sql: ${TABLE}."BillingAddress_country"

  - dimension: billing_country
    sql: CASE WHEN ${TABLE}."BillingCountry" = 'United States' THEN 'United States of America' ELSE ${TABLE}."BillingCountry" END

  - dimension: created_by_id
    sql: ${TABLE}."CreatedById"

  - dimension_group: created
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: is_deleted
    type: int
    sql: ${TABLE}."IsDeleted"

  - dimension: last_modified_by_id
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: name
    sql: ${TABLE}."Name"

  - dimension: owner_id
    sql: ${TABLE}."OwnerId"

#   - dimension: pt_type
#     sql: ${TABLE}."pt_type"

  - dimension: system_modstamp
    sql: ${TABLE}."SystemModstamp"

  - dimension: total_number_of_nodes
    type: number
    sql: ${TABLE}."Total_number_of_nodes__c"

  - measure: count
    type: count
    drill_fields: [id, name]

