use std::sync::{OnceLock, RwLock};

const REDACTION: &str = "***REDACTED***";
const GITHUB_TOKEN_PREFIXES: [&str; 5] = ["ghp_", "gho_", "ghu_", "ghs_", "ghr_"];
const MIN_GITHUB_TOKEN_SUFFIX_LEN: usize = 36;

static ACTIVE_TOKEN: OnceLock<RwLock<Option<String>>> = OnceLock::new();

fn active_token() -> &'static RwLock<Option<String>> {
    ACTIVE_TOKEN.get_or_init(|| RwLock::new(None))
}

pub fn remember_token(token: &str) {
    if token.trim().len() < 8 {
        return;
    }

    if let Ok(mut active) = active_token().write() {
        *active = Some(token.to_string());
    }
}

pub fn scrub_log_message(message: &str) -> String {
    let mut scrubbed = redact_active_token(message);
    scrubbed = redact_bearer_tokens(&scrubbed);
    redact_github_tokens(&scrubbed)
}

fn redact_active_token(message: &str) -> String {
    let Ok(active) = active_token().read() else {
        return message.to_string();
    };

    match active.as_deref() {
        Some(token) if token.len() >= 8 => message.replace(token, REDACTION),
        _ => message.to_string(),
    }
}

fn redact_bearer_tokens(message: &str) -> String {
    redact_after_marker(message, "Bearer ", "Bearer ", 1)
}

fn redact_github_tokens(message: &str) -> String {
    let mut output = String::with_capacity(message.len());
    let mut index = 0;

    while index < message.len() {
        let remainder = &message[index..];
        if let Some(prefix) = GITHUB_TOKEN_PREFIXES
            .iter()
            .find(|prefix| remainder.starts_with(**prefix))
        {
            let token_len = token_len(&remainder[prefix.len()..]);
            if token_len >= MIN_GITHUB_TOKEN_SUFFIX_LEN {
                output.push_str(prefix);
                output.push_str(REDACTION);
                index += prefix.len() + token_len;
                continue;
            }
        }

        let ch = remainder
            .chars()
            .next()
            .expect("index is always on a char boundary");
        output.push(ch);
        index += ch.len_utf8();
    }

    output
}

fn redact_after_marker(
    message: &str,
    marker: &str,
    replacement_prefix: &str,
    min_token_len: usize,
) -> String {
    let mut output = String::with_capacity(message.len());
    let mut index = 0;

    while let Some(offset) = message[index..].find(marker) {
        let marker_start = index + offset;
        let token_start = marker_start + marker.len();
        let token_len = token_len(&message[token_start..]);

        output.push_str(&message[index..marker_start]);
        if token_len >= min_token_len {
            output.push_str(replacement_prefix);
            output.push_str(REDACTION);
            index = token_start + token_len;
        } else {
            output.push_str(marker);
            index = token_start;
        }
    }

    output.push_str(&message[index..]);
    output
}

fn token_len(value: &str) -> usize {
    value
        .char_indices()
        .take_while(|(_, ch)| is_token_char(*ch))
        .map(|(index, ch)| index + ch.len_utf8())
        .last()
        .unwrap_or(0)
}

fn is_token_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_' || ch == '-'
}

#[cfg(test)]
mod tests {
    use std::sync::{Mutex, Once};

    use super::{remember_token, scrub_log_message};

    static LOGGER: CaptureLogger = CaptureLogger;
    static LOGGER_INSTALL: Once = Once::new();
    static CAPTURED_LINES: Mutex<Vec<String>> = Mutex::new(Vec::new());

    struct CaptureLogger;

    impl log::Log for CaptureLogger {
        fn enabled(&self, _metadata: &log::Metadata) -> bool {
            true
        }

        fn log(&self, record: &log::Record) {
            CAPTURED_LINES
                .lock()
                .expect("capture log mutex poisoned")
                .push(scrub_log_message(&record.args().to_string()));
        }

        fn flush(&self) {}
    }

    fn install_capture_logger() {
        LOGGER_INSTALL.call_once(|| {
            log::set_logger(&LOGGER).expect("test logger should install once");
            log::set_max_level(log::LevelFilter::Error);
        });
    }

    #[test]
    fn scrubs_github_token_prefixes() {
        let line = scrub_log_message("auth failed: ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA next");

        assert_eq!(line, "auth failed: ghp_***REDACTED*** next");
    }

    #[test]
    fn scrubs_bearer_tokens() {
        let line = scrub_log_message("request failed Authorization: Bearer abcDEF_123");

        assert_eq!(line, "request failed Authorization: Bearer ***REDACTED***");
    }

    #[test]
    fn scrubs_runtime_active_token_value() {
        remember_token("runtime-token-value-1234567890");

        let line = scrub_log_message("auth failed for runtime-token-value-1234567890");

        assert_eq!(line, "auth failed for ***REDACTED***");
    }

    #[test]
    fn leaves_short_github_like_values_intact() {
        let line = scrub_log_message("example ghp_short is not a token");

        assert_eq!(line, "example ghp_short is not a token");
    }

    #[test]
    fn log_error_path_scrubs_token_before_capture() {
        install_capture_logger();
        CAPTURED_LINES
            .lock()
            .expect("capture log mutex poisoned")
            .clear();

        log::error!("auth: {}", "ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

        let lines = CAPTURED_LINES.lock().expect("capture log mutex poisoned");
        assert_eq!(
            lines.last().map(String::as_str),
            Some("auth: ghp_***REDACTED***")
        );
    }
}
