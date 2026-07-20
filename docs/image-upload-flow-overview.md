# Image Upload Flow Overview

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TB
	Client[Client]
	TenantAdmin[Arkion Tenant Admin]
	KeyPair[Generate public/private keypair]

	subgraph CLIENT_AUTH_ROW[ ]
		direction LR
		ClientApp[Customer Client App]
		AssertionToken[Create assertion token with private key]
		ClientApp -->|0.3 Build assertion token| AssertionToken
	end

	Client --> ClientApp

	subgraph INTEGRATIONS[Integrations API]
		direction TB

		subgraph INTEGRATIONS_TOP[ ]
			direction LR
			Domain[Domain integrations-gateway.app.arkion.co]
			ApiDocs[API docs integrations-gateway.app.arkion.co/docs]
			DomainNote[Note app subdomain can differ by region or custom domain environment]
			Domain --- ApiDocs
			DomainNote -.-> Domain
			DomainSpacer[ ]
		end

		subgraph INTEGRATIONS_BODY[ ]
			direction LR

			subgraph TENANT[Tenant Scope]
				direction TB
				Tenant[Tenant tenant_id]
				CustProd[Customer A Production Customer]
				CustSandbox[Customer A Sandbox Customer]
				Tenant --> CustProd
				Tenant --> CustSandbox
			end

			subgraph CUSTOMERENV[Customer and Environment]
				direction TB
				CustList[Customers response: id and name]
				NameCheck{Does customer name contain sandbox?}
				UseProd[Use this customer_id for Production]
				UseSandbox[Use this customer_id for Dev/QA environment]
				CustList --> NameCheck
				NameCheck -->|No| UseProd
				NameCheck -->|Yes contains sandbox => Dev/QA| UseSandbox
			end

			subgraph SETUPAUTH[Setup and Auth]
				direction TB
				Auth[POST /tenant/:tenant_id/auth/token]
				GetCustomers[GET /tenant/:tenant_id/customers]
			end

			subgraph IMAGEUPLOAD[Image Upload]
				direction TB
				CreateProject[POST /tenant/:tenant_id/projects]
				CreateFlight[POST /tenant/:tenant_id/projects/:project_id/flights]
				GetSignedUrl[GET /tenant/:tenant_id/projects/:project_id/upload/presigned_upload_url]
				StartImport[POST /tenant/:tenant_id/projects/:project_id/upload/start_import]
				InferenceStatus[GET /tenant/:tenant_id/projects/:project_id/upload/inference_status]
			end
		end

		GetCustomers ~~~ CreateProject ~~~ CreateFlight ~~~ GetSignedUrl ~~~ StartImport ~~~ InferenceStatus
		UseProd -. maps to .-> CustProd
		UseSandbox -. maps to .-> CustSandbox
		UseProd -. used by .-> ClientApp
		UseSandbox -. used by .-> ClientApp

	end

	subgraph AWS[Inference]
		direction TB
		S3[(AWS S3 Bucket)]
		Worker[Inference Worker]
		Db[(Database)]
	end

	Client -->|0.1 Generate keypair| KeyPair
	KeyPair -->|0.2 Save public key| TenantAdmin
	TenantAdmin -->|Public key saved for tenant| Tenant
	ClientApp -->|0.4 POST assertion token| Auth
    
	Auth -->|Returns access token| ClientApp
	Auth -->|Token scoped by tenant/customer| Tenant

	ClientApp -->|0.5 Lookup available customers| GetCustomers
	GetCustomers --> CustList

	ClientApp -->|1 Create project with chosen customer_id #40;optional#41;| CreateProject
	CreateProject --> Db

	ClientApp -->|2 Create flight| CreateFlight
	CreateFlight --> Db

	ClientApp -->|3 Request signed_url per image| GetSignedUrl
	GetSignedUrl -->|Returns signed_url| ClientApp
	GetSignedUrl --> Db

	ClientApp -->|4 PUT image via signed_url| S3

	ClientApp -->|5 Start import after all uploads| StartImport
	StartImport --> Worker
	Worker --> Db
	S3 --> Worker

	ClientApp -->|6 Poll inference status| InferenceStatus
	InferenceStatus --> Db

	classDef client fill:#2a1f10,stroke:#d2a865,stroke-width:1.2px,color:#f8e7c6
	classDef clientHighlight fill:#3a0f0f,stroke:#ff8a65,stroke-width:2px,color:#ffd9cc
	classDef tenant fill:#102331,stroke:#6db5e7,stroke-width:1.2px,color:#d7efff
	classDef api fill:#12301c,stroke:#78d79a,stroke-width:1.2px,color:#ddfbe7
	classDef aws fill:#281538,stroke:#b896ff,stroke-width:1.2px,color:#eee3ff

	class Client clientHighlight
	class ClientApp client
	class Tenant,CustProd,CustSandbox tenant
	class Domain,ApiDocs,DomainNote,Auth,GetCustomers,CreateProject,CreateFlight,GetSignedUrl,StartImport,InferenceStatus api
	class S3,Worker,Db aws

	style INTEGRATIONS fill:#0b1020,stroke:#4f7cac,stroke-width:1.2px,color:#dbeafe
	style TENANT fill:#0d1a2a,stroke:#6db5e7,stroke-width:1.2px,color:#d7efff
	style CUSTOMERENV fill:#23191a,stroke:#f59e9e,stroke-width:1.2px,color:#ffe3e3
	style SETUPAUTH fill:#102214,stroke:#68d391,stroke-width:1.2px,color:#def7e7
	style IMAGEUPLOAD fill:#1b1228,stroke:#b896ff,stroke-width:1.2px,color:#eee3ff
	style AWS fill:#101625,stroke:#8b9bb8,stroke-width:1.2px,color:#e5e7eb
	style INTEGRATIONS_TOP fill:transparent,stroke:transparent,color:transparent
	style INTEGRATIONS_BODY fill:transparent,stroke:transparent,color:transparent
	style CLIENT_AUTH_ROW fill:transparent,stroke:transparent,color:transparent
	style DomainSpacer fill:transparent,stroke:transparent,color:transparent
```
