import re
import sys

def check_delimiters(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    script_blocks = re.finditer(r'<script>(.*?)</script>', content, re.DOTALL)
    
    for block_match in script_blocks:
        script_content = block_match.group(1)
        block_start_line = content[:block_match.start(1)].count('\n') + 1
        print(f"Checking script block starting at line {block_start_line}...")
        
        stack = []
        delimiters = {'{': '}', '(': ')', '[': ']'}
        reverse_delimiters = {v: k for k, v in delimiters.items()}
        
        i = 0
        line_num = block_start_line
        col = 0
        
        in_template_literal = False
        in_single_quote = False
        in_double_quote = False
        in_comment_single = False
        in_comment_multi = False
        in_regex = False

        while i < len(script_content):
            char = script_content[i]
            
            if char == '\n':
                line_num += 1
                col = 0
                in_comment_single = False
                if in_regex: # Regex cannot span multiple lines unless in some specific cases, but usually not in JS
                    in_regex = False
            else:
                col += 1

            if in_comment_single:
                i += 1
                continue
            
            if in_comment_multi:
                if script_content[i:i+2] == '*/':
                    in_comment_multi = False
                    i += 2
                    col += 1
                else:
                    i += 1
                continue

            if not (in_template_literal or in_single_quote or in_double_quote or in_regex):
                if script_content[i:i+2] == '//':
                    in_comment_single = True
                    i += 2
                    col += 1
                    continue
                if script_content[i:i+2] == '/*':
                    in_comment_multi = True
                    i += 2
                    col += 1
                    continue

            # Handle Escapes
            if (in_single_quote or in_double_quote or in_template_literal or in_regex) and char == '\\':
                i += 2
                col += 1
                continue

            if char == '`' and not (in_single_quote or in_double_quote or in_regex):
                in_template_literal = not in_template_literal
            elif char == "'" and not (in_template_literal or in_double_quote or in_regex):
                in_single_quote = not in_single_quote
            elif char == '"' and not (in_template_literal or in_single_quote or in_regex):
                in_double_quote = not in_double_quote
            elif char == '/' and not (in_template_literal or in_single_quote or in_double_quote or in_comment_single or in_comment_multi):
                # This is tricky: is it a regex or a division?
                # Simple heuristic: if preceded by an operator or start of line/statement, it's a regex
                prev_content = script_content[max(0, i-50):i].strip()
                if not prev_content or any(prev_content.endswith(op) for op in ['=', '(', '[', ',', ':', '!', '&', '|', '?', '{', ';', 'return']):
                    if not in_regex:
                        in_regex = True
                    else:
                        in_regex = False
                elif in_regex:
                    in_regex = False
            
            if not (in_template_literal or in_single_quote or in_double_quote or in_comment_single or in_comment_multi or in_regex):
                if char in delimiters:
                    stack.append((char, line_num, col))
                elif char in reverse_delimiters:
                    if not stack:
                        print(f"Unexpected closing {char} at line {line_num}, col {col}")
                    else:
                        last_char, last_line, last_col = stack.pop()
                        if last_char != reverse_delimiters[char]:
                            print(f"Mismatched {char} at line {line_num}, col {col}. Expected {delimiters[last_char]} to close {last_char} from line {last_line}, col {last_col}")
            
            i += 1

        for char, line_num, col in stack:
            print(f"Unclosed {char} from line {line_num}, col {col}")
        if in_template_literal:
            print("Unclosed template literal (backtick)")
        if in_single_quote:
            print("Unclosed single quote")
        if in_double_quote:
            print("Unclosed double quote")
        if in_regex:
            print("Unclosed regex")

if __name__ == "__main__":
    check_delimiters('app.html')
