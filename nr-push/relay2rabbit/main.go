package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/rabbitmq/amqp091-go"
)

func GetEnvFromProc1(varName string) (string, error) {
	data, err := os.ReadFile("/proc/1/environ")
	if err != nil {
		return "", fmt.Errorf("failed to read /proc/1/environ: %w", err)
	}

	// Split by null byte and search for the desired variable
	for _, env := range strings.Split(string(data), "\x00") {
		if strings.HasPrefix(env, varName+"=") {
			return strings.TrimPrefix(env, varName+"="), nil
		}
	}
	return "", fmt.Errorf("environment variable %s not found", varName)
}

type Event struct {
	Event struct {
		ID      string `json:"id"`
		Content string `json:"content"`
		// ... other fields if needed ...
	} `json:"event"`
}

func main() {
	//connStr := os.Getenv("RABBITMQ_URL")
	connStr, err := GetEnvFromProc1("RABBITMQ_URL")

	if err != nil {
		log.Fatalf("failed to read RABBITMQ_URL from /proc/1/environ\n")
	}

	conn, err := amqp091.Dial(connStr)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %s\n", err)
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		log.Fatalf("Failed to open a channel: %s\n", err)
	}
	defer ch.Close()

	q, err := ch.QueueDeclare(
		"myQueue", // Name of the queue
		false,     // Durable (false = not durable, i.e., will not survive server restarts)
		false,     // AutoDelete (false = queue will not be deleted automatically)
		false,     // Exclusive (false = other connections can access it)
		false,     // NoWait (false = the server will confirm the declaration)
		nil,       // Arguments (empty map here)
	)
	if err != nil {
		log.Fatalf("Failed to declare a queue: %s\n", err)
	}

	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		line := scanner.Text()
		fmt.Fprintf(os.Stderr, "Received input: %s\n", line)

		var event Event
		err := json.Unmarshal([]byte(line), &event)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing JSON: %s\n", err)
			continue
		}
		fmt.Fprintf(os.Stderr, "Parsed Event ID: '%s'\n", event.Event.ID)

		err = ch.Publish(
			"",
			q.Name,
			false,
			false,
			amqp091.Publishing{
				ContentType: "application/json",
				Body:        []byte(line),
			},
		)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Failed to publish a message: %s\n", err)
			continue
		}
		fmt.Fprintf(os.Stderr, "Published to RabbitMQ: %s\n", line)

		response := map[string]string{
			"action": "accept",
			"id":     event.Event.ID,
		}
		responseJSON, err := json.Marshal(response)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling response JSON: %s\n", err)
			continue
		}

		fmt.Println(string(responseJSON))
		fmt.Fprintf(os.Stderr, "Wrote to stdout: %s\n", string(responseJSON))
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Error reading from stdin: %s\n", err)
	}
}
