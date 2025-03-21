
# Use IMDSv2 to get current AZ

TASK_METADATA=$(curl -s ${ECS_CONTAINER_METADATA_URI_V4}/task)
echo "Task Metadata: $TASK_METADATA"

AZ=$(echo $TASK_METADATA | jq -r '.AvailabilityZone')
echo "Current Availability Zone: $AZ"

export MAIL_HOST="${SMTP_HOSTNAME}.${AZ}.${WORKSPACE}.${DOMAIN}"
export HTTP_PROXY="http://${PROXY_HOSTNAME}.${AZ}.${WORKSPACE}.${DOMAIN}:${PROXY_PORT}"

echo "SMTP_HOST: $MAIL_HOST"
echo "HTTP_PROXY: $HTTP_PROXY"
