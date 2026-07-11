output "instance_public_ip" {
  description = "Public IP of the free tier instance"
  value       = oci_core_instance.bridge_app.public_ip
}

output "app_url" {
  description = "Application URL (HTTP)"
  value       = "http://${oci_core_instance.bridge_app.public_ip}"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i <your-key> ubuntu@${oci_core_instance.bridge_app.public_ip}"
}

output "free_tier_remaining" {
  description = "Free tier headroom (A1.Flex: max 4 OCPUs / 24 GB total across all instances)"
  value       = "${4 - var.instance_ocpus} OCPUs / ${24 - var.instance_memory_gb} GB RAM remaining"
}
