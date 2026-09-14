.PHONY: setup dev test lint lint-fix typecheck build clean openapi example docker-build docker-up docker-down

setup: ## Install dependencies
	pnpm install

dev: ## Run the API with hot reload
	pnpm run dev

test: ## Run unit and integration tests
	pnpm run test

lint: ## Lint and check formatting
	pnpm run lint

lint-fix: ## Fix lint and formatting issues
	pnpm run lint:fix

typecheck: ## Type-check every package
	pnpm run typecheck

build: ## Build every package
	pnpm run build

clean: ## Remove build output
	pnpm run clean

openapi: ## Regenerate docs/api/openapi.json
	pnpm run openapi

example: ## Run the in-process inspection example
	pnpm run example

docker-build: ## Build the API container image
	docker build -f backend/Dockerfile -t stellar-txguard-api:local .

docker-up: ## Start the API with docker compose
	docker compose up --build

docker-down: ## Stop docker compose services
	docker compose down

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'
