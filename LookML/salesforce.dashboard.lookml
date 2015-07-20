- dashboard: salesforce
  title: Salesforce
  layout: tile
  tile_size: 100

#  filters:

  elements:

  - name: add_a_unique_name_543
    title: Total Leads
    type: single_value
    model: salesforce
    explore: lead
    measures: [lead.count]
    sorts: [lead.count desc]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    font_size: small
    width: 4
    height: 2

  - name: add_a_unique_name_121
    title: Total Opportunities
    type: single_value
    model: salesforce
    explore: opportunity
    measures: [opportunity.count]
    sorts: [opportunity.count desc]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    font_size: small
    width: 4
    height: 2
  
  - name: add_a_unique_name_651
    title: Total ACV
    type: single_value
    model: salesforce
    explore: opportunity
    measures: [opportunity.total_acv]
    sorts: [opportunity.total_acv desc]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    font_size: small
    width: 4
    height: 2
  
  - name: add_a_unique_name_736
    title: Lead Status by Geo
    type: looker_column
    model: salesforce
    explore: lead
    dimensions: [lead.geo, lead.status]
    pivots: [lead.geo]
    measures: [lead.count]
    sorts: [lead.count desc 1]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    colors: ['#706080', '#353b49', '#635189', '#b3a0dd', '#776fdf', '#1ea8df', '#a2dcf3',
      '#49cec1', '#e9b404', '#dc7350', '#ed6168']
    width: 8
  
  - name: add_a_unique_name_231
    title: Overall Lead Status Percentage
    type: looker_pie
    model: salesforce
    explore: lead
    dimensions: [lead.status]
    measures: [lead.count]
    sorts: [lead.count desc 1]
    limit: 500
    column_limit: ''
    show_view_names: true
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    colors: ['#706080', '#b3a0dd', '#776fdf', '#1ea8df', '#a2dcf3', '#49cec1', '#e9b404',
      '#dc7350', '#ed6168']
    inner_radius: 50
    width: 4
    
  - name: add_a_unique_name_630
    title: Accounts by Country
    type: looker_geo_choropleth
    model: salesforce
    explore: account
    dimensions: [account.billing_country]
    measures: [account.count]
    sorts: [account.count desc]
    limit: 500
    column_limit: ''
    show_view_names: true
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    map: world
    map_projection: ''
    quantize_colors: false
    loading: false
    colors: []
    width: 12

  - name: add_a_unique_name_65
    title: Opportunities by Close Week
    type: looker_area
    model: salesforce
    explore: opportunity
    dimensions: [opportunity.close_week]
    measures: [opportunity.count, opportunity.cumulative_total]
    sorts: [opportunity.close_week]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: false
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: false
    x_axis_scale: ordinal
    y_axis_combined: false
    show_null_labels: false
    show_null_points: true
    point_style: none
    interpolation: linear
    series_types:
      opportunity.count: column
    y_axis_orientation: [left, right]
    colors: ['#635189', '#776fdf', '#1ea8df', '#a2dcf3', '#49cec1', '#e9b404', '#dc7350',
      '#ed6168']
  
  - name: add_a_unique_name_865
    title: Lead to Win Funnel
    type: looker_column
    model: salesforce
    explore: lead
    measures: [lead.count, opportunity.count, opportunity.count_won]
    sorts: [lead.count desc]
    limit: 500
    column_limit: ''
    stacking: ''
    show_value_labels: false
    label_density: 10
    x_axis_gridlines: false
    y_axis_gridlines: true
    show_view_names: true
    show_y_axis_labels: true
    show_y_axis_ticks: true
    y_axis_tick_density: default
    y_axis_tick_density_custom: 5
    show_x_axis_label: true
    show_x_axis_ticks: true
    x_axis_scale: auto
    show_null_labels: false
    y_axis_combined: true
    colors: ['#635189', '#776fdf', '#1ea8df', '#a2dcf3', '#49cec1', '#e9b404', '#dc7350',
      '#ed6168']




