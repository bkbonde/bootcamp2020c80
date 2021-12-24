# Step45 - Learning Neptune, Graph Data Modeling, Gremlin, Graphs, AI, and Machine Learning

## Class Notes

AWS neptune is a graph database. In SQL database we can maintain different relationships between items and different tables. When relations increase or becoemes very complex it is hard for sql database to handle them or to query them. Graph databases make relations betweeen entities or items inside it.

- AWS Neptune

  - It supports two kind of graphs, property graphs and RDF graphs. We are only foccusing on property graphs and the query language we are going to use is "GREMLIN".
  - Graphs are made up of vertices(nodes) and edges (relations) while both can have properties.
  - Neptune is a cluster database and should be created within a VPC inside a subnet.
  - Naptune cluster have one primary database instance which support read and write operations. It also have neptune replica having same data as primary instance but only support read operation.

- VPC
  - It launch a service in virtualy isolated network.
  - VPC is like personal network and have some IP(10.0.0.0/24). Every connected device have an IP that identifies that device in a network. In the ip address 10.0.0 refers to the network and last segment to the connected device. We need to defien how many devices can be connected to the network so /24 do that part (2^(32-SubnetMask)).
  - When we need to divide our networ in different parts we need to define segments
  - Route Table define how traffic is redirecting from the network. Initially subnet is not coonected to internet. It is just connected with local network.
  - To connect with internet we need to define internet gateway.
  - NAT gateway is for connecting subnet to the internet. One way communication.
  - Secuirty groups work as firewall which moniters inbound and outbound traffic.
    - It sits between subnet and instance. It is for each instance.
  - ACLs are also like firewalls
    - It sits between subnet and routing tale. It is for each subnet.
