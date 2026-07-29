library(tidyverse)
library(ggplot2)
library(dplyr)
library(forecast)
library(fixest)
df <- read_csv("~/Desktop/influencer-dashboard/influencer_data.csv")
head(df)
model <- lm(revenue ~ event_count + purchase_probability + churn_probability, data = df)
summary(model)
ggplot(df, aes(x = post_date, y = revenue)) +
  geom_point() +
  geom_smooth(method = "lm")
ts_data <- ts(df$revenue, frequency = 7)
model_forecast <- auto.arima(ts_data)
forecast(model_forecast, h = 14)
# ---------------------------
# BACKEND: Läs modeller från BigQuery
# ---------------------------

library(bigrquery)

project <- "project-cb954e13-3b16-432f-aa7"

session_df <- bq_table_download(
  bq_project_query(project, "SELECT * FROM analytics_lab.session_level_model")
)

product_df <- bq_table_download(
  bq_project_query(project, "SELECT * FROM analytics_lab.product_performance_model")
)

country_df <- bq_table_download(
  bq_project_query(project, "SELECT * FROM analytics_lab.country_performance_model")
)
