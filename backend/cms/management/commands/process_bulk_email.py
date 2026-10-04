from django.core.management.base import BaseCommand

from cms.bulk_email import process_due_batches


class Command(BaseCommand):
    help = "Send the next due burst of any running bulk email batches."

    def handle(self, *args, **options):
        attempted = process_due_batches()
        self.stdout.write(f"Attempted {attempted} bulk email(s).")
