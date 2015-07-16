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

  - dimension: closedate
    sql: ${TABLE}."CloseDate"

  - dimension: contract_term
    sql: ${TABLE}."Contract_Term__c"

  - dimension: createdbyid
    sql: ${TABLE}."CreatedById"

  - dimension_group: created
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."CreatedDate",1,10) || ' ' || substring(${TABLE}."CreatedDate",12,8),'YYYY-MM-DD HH24:MI:SS') 

  - dimension: executive_sponsor
    sql: ${TABLE}."Executive_Sponsor__c"

  - dimension: fiscal
    sql: ${TABLE}."Fiscal"

  - dimension: fiscalquarter
    type: number
    sql: ${TABLE}."FiscalQuarter"

  - dimension: fiscalyear
    type: number
    sql: ${TABLE}."FiscalYear"

  - dimension: forecastcategory
    sql: ${TABLE}."ForecastCategory"

  - dimension: forecastcategoryname
    sql: ${TABLE}."ForecastCategoryName"

  - dimension: hasopportunitylineitem
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

  - dimension: is_closed
    type: number
    sql: ${TABLE}."IsClosed"

  - dimension: is_deleted
    type: number
    sql: ${TABLE}."IsDeleted"

  - dimension: is_won
    type: number
    sql: ${TABLE}."IsWon"

  - dimension: is_this_follow_on_to_poc__c
    sql: ${TABLE}."Is_this_follow_on_to_POC__c"

  - dimension: lastmodifiedbyid
    sql: ${TABLE}."LastModifiedById"

  - dimension: last_modified
    type: time
    timeframes: [date, month, week]
    sql: TO_DATE(substring(${TABLE}."LastModifiedDate",1,10) || ' ' || substring(${TABLE}."LastModifiedDate",12,8),'YYYY-MM-DD HH24:MI:SS')

  - dimension: leadsource
    sql: ${TABLE}."LeadSource"

  - dimension: lead_source_group
    sql: ${TABLE}."Lead_Source_Group__c"

  - dimension: lifetime_expected_value
    type: number
    sql: ${TABLE}."Lifetime_Expected_Value__c"

  - dimension: mrr
    sql: ${TABLE}."MRR__c"

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

  - dimension: ownerid
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

  - dimension: stagename
    sql: ${TABLE}."StageName"

  - dimension: steps_to_closure__c
    sql: ${TABLE}."Steps_to_Closure__c"

  - dimension: supportplan
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

  - dimension: attributes_type
    sql: ${TABLE}."Attributes_Type"

  - dimension: attributes_url
    sql: ${TABLE}."attributes_url"

  - dimension: pt_type
    sql: ${TABLE}."pt_type"
  
  - measure: count
    type: count
    drill_fields: detail*

  sets:
    detail:
      - acv__c
      - accountid
      - cra_compelling_reason_to_act__c
      - campaignid
      - closedate
      - contract_term__c
      - createdbyid
      - createddate
      - executive_sponsor__c
      - fiscal
      - fiscalquarter
      - fiscalyear
      - forecastcategory
      - forecastcategoryname
      - hasopportunitylineitem
      - ibm_forecast_stage__c
      - ibm_opp_id__c
      - ibm_sales_stage__c
      - imt__c
      - iot__c
      - id
      - isclosed
      - isdeleted
      - iswon
      - is_this_follow_on_to_poc__c
      - lastmodifiedbyid
      - lastmodifieddate
      - leadsource
      - lead_source_group__c
      - lifetime_expected_value__c
      - mrr__c
      - name
      - new_appt_date__c
      - number_of_deals__c
      - ownerid
      - probability
      - probability_of_closure_cq__c
      - projected_turnover_date__c
      - revenue_type2__c
      - signings2x__c
      - stagename
      - steps_to_closure__c
      - supportplan__c
      - support_contact1__c
      - systemmodstamp
      - total_revenue1__c
      - type
      - type_finance__c
      - uvp_unique_value_proposition__c
      - _id
      - _rev
      - attributes_type
      - attributes_url
      - pt_type

