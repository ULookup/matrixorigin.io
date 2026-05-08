---
title: "AES_ENCRYPT()"
doc_type: reference
mysql_compat: partial
differs_from_mysql: ["Only aes-128-ecb and aes-256-cbc are supported via block_encryption_mode; other MySQL modes are not implemented."]
mo_only: false
since: v3.0.11
last_updated: 2026-05-08
llms_summary: "AES_ENCRYPT encrypts plaintext with a key and returns a BLOB using the mode set by block_encryption_mode, supporting aes-128-ecb (default) and aes-256-cbc with a required 16-byte IV in MatrixOne."
---

# **AES_ENCRYPT()**

> `AES_ENCRYPT(str, key_str[, init_vector])` encrypts a string using AES and returns a `BLOB` ciphertext; the mode is selected by session variable `block_encryption_mode` (`aes-128-ecb` default; `aes-256-cbc` requires a 16-byte IV in the third argument).

## **Description**

The `AES_ENCRYPT()` function encrypts `str` with `key_str` using AES and returns the ciphertext as a `BLOB`. The encryption mode is selected by the session variable [`block_encryption_mode`](../../Variable/system-variables/system-variables-overview.md).

MatrixOne currently supports two modes:

- `aes-128-ecb` (default). Key is derived to 16 bytes; the optional `init_vector` argument is ignored.
- `aes-256-cbc`. Key is derived to 32 bytes; the `init_vector` argument is required and must be at least 16 bytes.

The function returns `NULL` in any of the following cases:

- `str` or `key_str` is `NULL`.
- `block_encryption_mode` is set to an unsupported value.
- CBC mode is selected but the IV is missing, `NULL`, or shorter than 16 bytes.
- Key derivation or the underlying AES operation fails.

## **Syntax**

```
> AES_ENCRYPT(str, key_str)
> AES_ENCRYPT(str, key_str, init_vector)
```

## **Arguments**

| Arguments | Description |
| ---- | ---- |
| str | Required. The plaintext string to encrypt. Accepts `VARCHAR`, `CHAR`, `TEXT`, or `BLOB`. |
| key_str | Required. The encryption key. |
| init_vector | Optional. The initialization vector, required when `block_encryption_mode` selects a CBC mode. Must be at least 16 bytes. |

## **Examples**

<!-- validator-ignore-exec -->
```sql
mysql> SET block_encryption_mode = 'aes-128-ecb';
mysql> SELECT HEX(AES_ENCRYPT('MatrixOne', 'my-secret-key'));
+-------------------------------------------------+
| hex(aes_encrypt(matrixone, my-secret-key))      |
+-------------------------------------------------+
| 3B1A...                                         |
+-------------------------------------------------+

mysql> SET block_encryption_mode = 'aes-256-cbc';
mysql> SELECT HEX(AES_ENCRYPT('MatrixOne', 'my-secret-key', '0123456789abcdef'));
```

## **See also**

- [`AES_DECRYPT()`](aes_decrypt.md)
