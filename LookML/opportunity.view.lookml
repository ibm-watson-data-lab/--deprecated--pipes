- view: opportunity
  sql_table_name: '"sf_opportunity"'

  fields:

  - dimension: acv
    type: number
    sql: ${TABLE}."ACV__c"

  - dimension: account_id
    sql: ${TABLE}."AccountId"

  - dimension: cra_compelling_reason_to_act
    sql: ${TABLE}."CRA_Compelling_Reason_to_Act__c"

  - dimension: campaign_id
    sql: ${TABLE}."CampaignId"

  - dimension_group: close
    sql: ${TABLE}."CloseDate"
    type: time
    timeframes: [date,week,month,year]
    convert_tz: false
    
  - dimension: contract_term
    sql: ${TABLE}."Contract_Term__c"

  - dimension: created_by_id
    sql: ${TABLE}."CreatedById"

  - dimension_group: created
    type: time
    timeframes: [date, month, week, year]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: executive_sponsor
    sql: ${TABLE}."Executive_Sponsor__c"

  - dimension: fiscal
    sql: ${TABLE}."Fiscal"

  - dimension: fiscal_quarter
    type: number
    sql: ${TABLE}."FiscalQuarter"

  - dimension: fiscal_year
    type: number
    sql: ${TABLE}."FiscalYear"

  - dimension: forecast_category
    sql: ${TABLE}."ForecastCategory"

  - dimension: forecast_category_name
    sql: ${TABLE}."ForecastCategoryName"

  - dimension: has_opportunity_line_item
    type: number
    sql: ${TABLE}."HasOpportunityLineItem"

  - dimension: ibm_forecast_stage
    sql: ${TABLE}."IBM_Forecast_Stage__c"

  - dimension: ibm_opp_id
    sql: ${TABLE}."IBM_Opp_ID__c"

  - dimension: ibm_sales_stage
    sql: ${TABLE}."IBM_Sales_Stage__c"

  - dimension: imt
    sql: ${TABLE}."IMT__c"

  - dimension: iot
    sql: ${TABLE}."IOT__c"

  - dimension: id
    sql: ${TABLE}."Id"
    primary_key: true

  - dimension: is_closed
    type: number
    sql: ${TABLE}."IsClosed"

  - dimension: is_deleted
    type: number
    sql: ${TABLE}."IsDeleted"

  - dimension: is_won
    type: number
    sql: ${TABLE}."IsWon"

  - dimension: is_this_follow_on_to_poc
    sql: ${TABLE}."Is_this_follow_on_to_POC__c"

  - dimension: last_modified_by_id
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS')

  - dimension: lead_source
    sql: ${TABLE}."LeadSource"

  - dimension: lead_source_group
    sql: ${TABLE}."Lead_Source_Group__c"

  - dimension: lifetime_expected_value
    type: number
    sql: ${TABLE}."Lifetime_Expected_Value__c"

#   - dimension: mrr
#     sql: ${TABLE}."MRR__c"

  - dimension: name
    sql: ${TABLE}."Name"

  - dimension: new_appt
    sql: ${TABLE}."New_Appt_Date__c"
    type: time
    timeframes: [date, month, week, year]
    convert_tz: false

  - dimension: number_of_deals
    type: number
    sql: ${TABLE}."Number_of_Deals__c"

  - dimension: owner_id
    sql: ${TABLE}."OwnerId"

  - dimension: probability
    type: number
    sql: ${TABLE}."Probability"

  - dimension: probability_of_closure_cq
    sql: ${TABLE}."Probability_of_Closure_CQ__c"

  - dimension: projected_turnover_date
    sql: ${TABLE}."Projected_Turnover_Date__c"

  - dimension: revenue_type_2
    sql: ${TABLE}."Revenue_Type2__c"

  - dimension: signings2x
    type: number
    sql: ${TABLE}."Signings2x__c"

  - dimension: stage_name
    sql: ${TABLE}."StageName"

  - dimension: steps_to_closure__c
    sql: ${TABLE}."Steps_to_Closure__c"

  - dimension: support_plan
    sql: ${TABLE}."SupportPlan__c"

  - dimension: support_contact1
    sql: ${TABLE}."Support_Contact1__c"

  - dimension: systemmodstamp
    sql: ${TABLE}."SystemModstamp"

  - dimension: total_revenue_1
    type: number
    sql: ${TABLE}."Total_Revenue1__c"

  - dimension: type
    sql: ${TABLE}."Type"

  - dimension: type_finance
    sql: ${TABLE}."Type_Finance__c"

  - dimension: uvp_unique_value_proposition
    sql: ${TABLE}."UVP_Unique_Value_Proposition__c"

  - dimension: _id
    sql: ${TABLE}."_id"

  - dimension: _rev
    sql: ${TABLE}."_rev"

#   - dimension: attributes_type
#     sql: ${TABLE}."Attributes_Type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

  - dimension: pt_type
    sql: ${TABLE}."pt_type"
  
  - measure: count
    type: count
    drill_fields: detail*
  
  - measure: count_won
    type: count
    filter: 
      is_won: 1
    drill_fields: detail*
      
  - measure: cumulative_total
    type: running_total
    sql: ${count}
    drill_fields: detail*
  
  - measure: total_acv
    type: sum
    sql: ${acv}
    value_format: '$#,##0.00'
    drill_fields: detail*
  
#   - measure: total_mrr
#     type: sum
#     sql: ${mrr}
#     value_format: '$#,##0.00'
#     drill_fields: detail*

  sets:
    detail:
      - close_date
      - created_date
      - id
      - mrr
      - name
      - probability
      - stagename
      - type
