// Health check script for frontend container
const http = require("http");

// Configuration
const HEALTH_CHECK_URL =
    process.env.HEALTH_CHECK_URL || "http://localhost:3000";
const MAX_RETRIES = 3;
const RETRY_INTERVAL = 3000; // 3 seconds

let retryCount = 0;

function checkHealth() {
    return new Promise((resolve, reject) => {
        const req = http.request(HEALTH_CHECK_URL, (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                if (res.statusCode === 200) {
                    console.log("Health check passed");
                    resolve(true);
                } else {
                    console.log(
                        `Health check failed with status: ${res.statusCode}`,
                    );
                    reject(new Error(`Health check failed`));
                }
            });
        });

        req.on("error", (err) => {
            console.log(`Health check error: ${err.message}`);
            reject(err);
        });

        req.on("timeout", () => {
            console.log("Health check timeout");
            reject(new Error("Health check timeout"));
        });

        req.setTimeout(3000, () => {
            req.destroy();
            reject(new Error("Health check timeout"));
        });
    });
}

function runHealthCheck() {
    if (retryCount >= MAX_RETRIES) {
        console.log("Max retries reached, exiting");
        process.exit(1);
    }

    retryCount++;

    checkHealth()
        .then(() => {
            console.log("Application is healthy");
            process.exit(0);
        })
        .catch((err) => {
            console.log(
                `Health check failed, retry ${retryCount}/${MAX_RETRIES}`,
            );
            setTimeout(runHealthCheck, RETRY_INTERVAL);
        });
}

// Start health check
console.log("Starting health check...");
runHealthCheck();
