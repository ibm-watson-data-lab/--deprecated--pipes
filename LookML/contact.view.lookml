- view: contact
  sql_table_name: '"sf_contact"'
  fields:

  - dimension: id
    primary_key: true
    sql: ${TABLE}."Id"

  - dimension: _id
    sql: ${TABLE}."_id"

  - dimension: _rev
    sql: ${TABLE}."_rev"

  - dimension: attributes_type
    sql: ${TABLE}."attributes_type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

  - dimension: created_by_id
    sql: ${TABLE}."CreatedById"

  - dimension_group: created
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS')

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

  - dimension: is_deleted
    type: int
    sql: ${TABLE}."IsDeleted"

  - dimension: is_email_bounced
    type: int
    sql: ${TABLE}."IsEmailBounced"

  - dimension: last_modified_by_id
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: last_name
    sql: ${TABLE}."LastName"

  - dimension: mailing_address_country
    sql: ${TABLE}."MailingAddress_country"

  - dimension: mailing_country
    sql: ${TABLE}."MailingCountry"

  - dimension: name
    sql: ${TABLE}."Name"

  - dimension: owner_id
    sql: ${TABLE}."OwnerId"

  - dimension: pt_type
    sql: ${TABLE}."pt_type"

  - dimension: source_group
    sql: ${TABLE}."Source_Group__c"

  - dimension: system_modstamp
    sql: ${TABLE}."SystemModstamp"

  - dimension: title
    sql: ${TABLE}."Title"

  - measure: count
    type: count
    drill_fields: [id, first_name, last_name, name]

