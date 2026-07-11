variable "tenancy_ocid" {
  description = "OCI tenancy OCID"
  type        = string
}

variable "user_ocid" {
  description = "OCI user OCID"
  type        = string
}

variable "fingerprint" {
  description = "OCI API key fingerprint"
  type        = string
}

variable "private_key_path" {
  description = "Path to OCI API private key"
  type        = string
}

variable "region" {
  description = "OCI region"
  type        = string
  default     = "uk-london-1"
}

variable "compartment_ocid" {
  description = "OCI compartment OCID"
  type        = string
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for instance access"
  type        = string
}

variable "admin_cidr" {
  description = "CIDR block allowed for SSH access"
  type        = string
  default     = "0.0.0.0/0"
}

variable "instance_shape" {
  description = "OCI instance shape (use VM.Standard.A1.Flex or VM.Standard.E2.1.Micro for free tier)"
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "Number of OCPUs (max 4 for A1.Flex free tier)"
  type        = number
  default     = 1
}

variable "instance_memory_gb" {
  description = "Memory in GB (max 24 for A1.Flex free tier)"
  type        = number
  default     = 6
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "bridgejobs.ug"
}

variable "jwt_secret" {
  description = "JWT secret for the application"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "cors_origin" {
  description = "CORS origin for the application"
  type        = string
  default     = "https://bridgejobs.ug"
}

variable "frontend_url" {
  description = "Frontend URL for the application"
  type        = string
  default     = "https://bridgejobs.ug"
}

variable "vcn_cidr" {
  description = "CIDR block for the VCN"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}
