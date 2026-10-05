from django.core.management.base import BaseCommand

from cms.bulk_email import process_due_batches


class Command(BaseCommand):
    help = "Send the next due burst of bulk email and back-in-stock batches."

    def handle(self, *args, **options):
        attempted = process_due_batches()
        from catalog.stock_notify import process_due_batches as process_stock

        stocked = process_stock()
        self.stdout.write(f"Attempted {attempted} bulk email(s) and {stocked} stock notification(s).")
