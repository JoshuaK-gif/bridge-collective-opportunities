data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_ocid
}

locals {
  ad = data.oci_identity_availability_domains.ads.availability_domains[0].name
}

resource "oci_core_instance" "bridge_app" {
  compartment_id      = var.compartment_ocid
  availability_domain = local.ad
  display_name        = "bridge-app-server"
  shape               = var.instance_shape

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = 50
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data           = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      domain      = var.domain_name
      jwt_secret  = var.jwt_secret
      db_password = var.db_password
      cors_origin = var.cors_origin
      frontend_url = var.frontend_url
    }))
  }

  create_vnic_details {
    assign_public_ip          = true
    display_name              = "bridge-app-vnic"
    subnet_id                 = oci_core_subnet.bridge_public_subnet.id
    skip_source_dest_check    = false
  }
}

# Free tier note: VM.Standard.A1.Flex (Ampere ARM) gives up to 4 OCPUs / 24 GB RAM free
# Total free storage across all boot volumes: 200 GB (using 50 GB here)
# No load balancer needed — Caddy runs on the instance for TLS termination

data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "24.04"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}
