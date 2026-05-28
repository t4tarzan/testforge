package main

import "testing"

func TestAdd(t *testing.T) {
	if Add(1, 2) != 3 {
		t.Fatal("Add(1,2) should be 3")
	}
}

func TestAddZero(t *testing.T) {
	if Add(0, 0) != 0 {
		t.Fatal("Add(0,0) should be 0")
	}
}

func BenchmarkAdd(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Add(1, 2)
	}
}
