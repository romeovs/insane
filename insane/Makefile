bin = ./node_modules/.bin

.PHONY: always

WATCH_FLAG := $(subst watch,--watch,$(findstring watch,$(MAKECMDGOALS)))

test: always
	@$(bin)/vitest $(WATCH_FLAG)

bench: always
	@$(bin)/vitest bench $(WATCH_FLAG)

build: always
	@$(bin)/vite build $(WATCH_FLAG)

tool.build: always
	@node ./dist/tool/index.mjs build

tool.dev: always
	@node ./dist/tool/index.mjs dev
