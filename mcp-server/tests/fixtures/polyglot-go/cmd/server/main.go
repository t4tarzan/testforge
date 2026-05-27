package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	r.GET("/health", healthHandler)
	r.GET("/users/:id", getUser)
	r.POST("/users", createUser)
	r.PATCH("/users/:id", updateUser)
	r.DELETE("/users/:id", deleteUser)

	// stdlib mixed in
	http.HandleFunc("/metrics", metricsHandler)

	_ = r.Run(":8080")
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func getUser(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func createUser(c *gin.Context) {
	c.JSON(http.StatusCreated, gin.H{"id": "u1"})
}

func updateUser(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{})
}

func deleteUser(c *gin.Context) {
	c.JSON(http.StatusNoContent, nil)
}

func metricsHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
}
