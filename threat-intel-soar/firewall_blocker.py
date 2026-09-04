"""Block a malicious IP at the firewall — DRY-RUN by default.

Bu skript defolt olaraq HEÇ BİR real dəyişiklik etmir, sadəcə nə edəcəyini
çap edir/loglayır. Real blok yalnız --live bayrağı ilə VƏ execute_block()
funksiyası öz mühitinizə (iptables/cloud firewall/NGFW) uyğun implement
edildikdən sonra işləyir. Bu, təsadüfən real IP blok etməməyiniz üçün
qəsdən belə saxlanılıb.

Usage:
    python firewall_blocker.py --ip 1.2.3.4              # dry-run (defolt)
    python firewall_blocker.py --ip 1.2.3.4 --live        # real block (implementasiya tələb edir)
"""
import argparse
import datetime
import ipaddress
import sys

from config import FIREWALL_DRY_RUN


def log_action(ip, action="block"):
    ts = datetime.datetime.utcnow().isoformat()
    print(f"[{ts}] [DRY-RUN] {action.upper()} would be applied to {ip}")


def execute_block(ip):
    # 🔴 TODO-DOLDUR: Real mühitinizə uyğun firewall inteqrasiyasını (məs. iptables,
    # cloud provider SDK, next-gen firewall API) burada implement edin.
    raise NotImplementedError(
        "Real block implementasiya olunmayıb — bu, təhlükəsizlik üçün qəsdən boş saxlanılıb."
    )


def block_ip(ip, dry_run=None):
    ipaddress.ip_address(ip)  # yanlış formatda IP olsa ValueError atır

    dry_run = FIREWALL_DRY_RUN if dry_run is None else dry_run

    if dry_run:
        log_action(ip, "block")
        return True

    execute_block(ip)
    return True


def main():
    parser = argparse.ArgumentParser(description="SOCore firewall blocker (dry-run by default)")
    parser.add_argument("--ip", required=True, help="Bloklanacaq IP ünvanı")
    parser.add_argument("--live", action="store_true", help="🔴 DİQQƏT: real block etmək üçün (defolt: dry-run)")
    args = parser.parse_args()

    try:
        block_ip(args.ip, dry_run=not args.live)
    except ValueError:
        print(f"Yanlış IP ünvanı: {args.ip}", file=sys.stderr)
        sys.exit(1)
    except NotImplementedError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
