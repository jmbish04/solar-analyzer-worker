# Product Requirements Document: Solar Financial Analysis Worker

## 1. Overview

This document outlines the requirements for the backend worker that supports the Solar Financial Analysis Tool. The worker's primary responsibility is to provide the frontend with the necessary data for visualizations, calculations, and modeling.

## 2. Goals

*   To provide a reliable and secure API for the frontend application.
*   To abstract the complexities of data fetching and processing from the frontend.
*   To ensure the accuracy and integrity of the data provided to the frontend.

## 3. Key Features

### 3.1. Data Endpoints

The worker will expose a set of API endpoints to provide the frontend with the following data:

*   **Historical Financial Loss Data:** The worker will calculate and provide data on the financial losses incurred due to the damaged solar panels. This will involve comparing the user's actual energy costs with their expected costs had the solar panels been operational.
*   **NEM 3.0 Modeling Data:** The worker will provide the data necessary for the NEM 3.0 modeler, including:
    *   Projected solar energy production based on the user's location and system configuration.
    *   Historical and projected PGE rate data for both NEM 2.0 and NEM 3.0.
    *   Information on the costs of new solar arrays and battery storage systems.
*   **User Data:** The worker will manage user-specific data, such as their solar panel configuration and historical energy usage.

### 3.2. Data Sources

The worker will integrate with the following data sources:

*   **PVWatts API:** To get solar energy production data.
*   **Sunrise-Sunset API:** To get sunrise and sunset times for solar calculations.
*   **PGE:** To get historical and current electricity rate data.
*   **D1 Database:** To store user data, cached API responses, and other application data.

### 3.3. NEM 3.0 Modeling Engine

The worker will include a modeling engine to perform the complex calculations required for the NEM 3.0 modeler. This will involve:

*   Calculating the optimal solar array size and battery storage capacity based on the user's energy usage patterns.
*   Projecting the long-term financial impact of NEM 3.0, considering factors such as inflation and projected rate increases.
*   Providing the frontend with the data needed to generate visualizations and comparisons of different scenarios.

## 4. Technical Requirements

*   **Platform:** Cloudflare Workers.
*   **Database:** Cloudflare D1.
*   **API:** A RESTful API exposed via HTTPS.
*   **Security:** The API will be secured to protect user data.
*   **Scalability:** The worker will be designed to handle a reasonable number of concurrent users.
