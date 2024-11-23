BINARY_NAME=pushToRabbitmq
GO_MOD_PATH=$(shell go list -m)

build:
	CC=musl-gcc CGO_ENABLED=0 go build -o $(BINARY_NAME) main.go

run: build
	export RABBITMQ_URL="amqp://user:password@localhost:5672";\
		echo '{"foo:1}\n{"bar":2}\n' | ./$(BINARY_NAME) | tee /dev/null

install-deps:
	go mod tidy

clean:
	rm -f $(BINARY_NAME)

all: build run



deploy:
	make clean
	make build
	scp pushToRabbitmq tr:/tmp # home/user/tr-ops/nostroots-server/data/strfry-data/plugins/pushToRabbitmq
	ssh tr 'sudo cp /tmp/pushToRabbitmq /home/user/tr-ops/nostroots-server/data/strfry-data/plugins'
