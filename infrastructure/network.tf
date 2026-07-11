resource "oci_core_vcn" "bridge_vcn" {
  compartment_id = var.compartment_ocid
  display_name   = "bridge-vcn"
  cidr_blocks    = [var.vcn_cidr]
  dns_label      = "bridgevcn"
}

resource "oci_core_internet_gateway" "bridge_igw" {
  compartment_id = var.compartment_ocid
  display_name   = "bridge-internet-gateway"
  vcn_id         = oci_core_vcn.bridge_vcn.id
}

resource "oci_core_route_table" "bridge_public_rt" {
  compartment_id = var.compartment_ocid
  display_name   = "bridge-public-route-table"
  vcn_id         = oci_core_vcn.bridge_vcn.id

  route_rules {
    network_entity_id = oci_core_internet_gateway.bridge_igw.id
    destination       = "0.0.0.0/0"
    description       = "Default route to internet gateway"
  }
}

resource "oci_core_subnet" "bridge_public_subnet" {
  compartment_id    = var.compartment_ocid
  display_name      = "bridge-public-subnet"
  vcn_id            = oci_core_vcn.bridge_vcn.id
  cidr_block        = var.subnet_cidr
  dns_label         = "bridgepub"
  route_table_id    = oci_core_route_table.bridge_public_rt.id
  security_list_ids = [oci_core_security_list.bridge_security_list.id]
  prohibit_public_ip_on_vnic = false
}

resource "oci_core_security_list" "bridge_security_list" {
  compartment_id = var.compartment_ocid
  display_name   = "bridge-security-list"
  vcn_id         = oci_core_vcn.bridge_vcn.id

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
    description = "Allow all outbound traffic"
  }

  ingress_security_rules {
    protocol    = "6"
    source      = var.admin_cidr
    description = "SSH access"
    tcp_options {
      destination_port_range {
        min = 22
        max = 22
      }
    }
  }

  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTP access"
    tcp_options {
      destination_port_range {
        min = 80
        max = 80
      }
    }
  }

  ingress_security_rules {
    protocol    = "6"
    source      = "0.0.0.0/0"
    description = "HTTPS access"
    tcp_options {
      destination_port_range {
        min = 443
        max = 443
      }
    }
  }

  ingress_security_rules {
    protocol = "1"
    source   = var.vcn_cidr
    description = "ICMP (ping) within VCN"
  }
}
