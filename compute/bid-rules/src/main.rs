use std::io::{Read, Write};

fn main() {
    let mut input = String::new();
    if let Err(error) = std::io::stdin().read_to_string(&mut input) {
        let fallback = format!(
            "{{\"schema\":\"mend.bid-rules.v1\",\"error\":{{\"code\":\"SCORE_INVALID\",\"message\":\"failed to read stdin: {error}\"}}}}"
        );
        let _ = std::io::stdout().write_all(fallback.as_bytes());
        return;
    }

    let output = mend_bid_rules::evaluate_json(&input);
    let mut stdout = std::io::stdout();
    if stdout.write_all(output.as_bytes()).is_err() {
        return;
    }
    let _ = stdout.flush();
}
