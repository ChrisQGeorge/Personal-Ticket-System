# PTS Test Suite

## Prerequisites

```
pip install -r tests/requirements.txt
```

## Running

Make sure Docker containers are running, then:

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_security.py -v

# Run with output
pytest tests/ -v -s
```

## Environment

Set `PTS_TEST_URL` to test against a different host:

```bash
PTS_TEST_URL=http://192.168.1.100:9999 pytest tests/ -v
```
