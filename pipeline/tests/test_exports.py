from conftest import load_json, assert_series_group
import math

class TestLaborJson:
    def setup_method(self):
        self.data = load_json("labor.json")

    def test_has_required_keys(self):
        for key in ["tech_employment", "employment_context", "jolts_info", "jolts_probus", "jolts_total", "unemployment"]:
            assert key in self.data, f"Missing key: {key}"

    def test_series_groups_valid(self):
        for key in self.data:
            assert_series_group(self.data[key], min_rows=100)

    def test_jolts_info_has_four_labels(self):
        labels = self.data["jolts_info"]["labels"]
        assert len(labels) == 4
        assert "Job Openings" in labels
        assert "Hires" in labels
        assert "Quits" in labels
        assert "Layoffs" in labels

    def test_jolts_total_has_layoffs(self):
        assert "Layoffs" in self.data["jolts_total"]["labels"]


class TestAnalyticsJson:
    def setup_method(self):
        self.data = load_json("analytics.json")

    def test_has_required_keys(self):
        expected = [
            "info_employment_yoy", "info_openings_hires_ratio", "info_quits_rate",
            "jolts_openings_comparison", "jolts_hires_comparison", "jolts_quits_comparison",
            "jolts_layoffs_comparison", "info_net_flow", "total_net_flow", "info_employment_mom",
        ]
        for key in expected:
            assert key in self.data, f"Missing key: {key}"

    def test_all_groups_valid(self):
        for key in self.data:
            group = self.data[key]
            # Some analytics groups are single-series (no labels key)
            if "labels" in group:
                assert_series_group(group, min_rows=50)
            else:
                assert "title" in group
                assert "data" in group
                assert len(group["data"]) >= 50, f"Only {len(group['data'])} rows in {key}"

    def test_net_flow_has_pct(self):
        row = self.data["info_net_flow"]["data"][0]
        assert "net_flow_pct" in row

    def test_mom_has_delta(self):
        row = self.data["info_employment_mom"]["data"][0]
        assert "mom_delta" in row

    def test_no_nan_in_computed_fields(self):
        for row in self.data["info_net_flow"]["data"]:
            assert not (isinstance(row["net_flow_pct"], float) and math.isnan(row["net_flow_pct"]))
        for row in self.data["info_employment_mom"]["data"]:
            assert not (isinstance(row["mom_delta"], float) and math.isnan(row["mom_delta"]))


class TestSectorsJson:
    def setup_method(self):
        self.data = load_json("sectors.json")

    def test_has_required_keys(self):
        for key in ["rankings", "sector_labels", "timeseries", "combined", "growth_over_time"]:
            assert key in self.data

    def test_rankings_count(self):
        assert len(self.data["rankings"]) >= 15

    def test_rankings_have_yoy(self):
        for r in self.data["rankings"]:
            assert "yoy_pct" in r
            assert "sector" in r

    def test_sector_labels_count(self):
        assert len(self.data["sector_labels"]) == 17


class TestLayoffsJson:
    def setup_method(self):
        self.data = load_json("layoffs.json")

    def test_has_required_keys(self):
        for key in ["monthly", "industry_monthly", "top_events", "recent_events"]:
            assert key in self.data, f"Missing key: {key}"

    def test_monthly_valid(self):
        assert_series_group(self.data["monthly"], min_rows=10)

    def test_top_events_structure(self):
        assert len(self.data["top_events"]) >= 10
        event = self.data["top_events"][0]
        assert "company" in event
        assert "date" in event
        assert "laid_off" in event

    def test_recent_events_structure(self):
        assert len(self.data["recent_events"]) >= 10
        event = self.data["recent_events"][0]
        assert "company" in event
        assert "date" in event
        assert "laid_off" in event

    def test_warn_monthly_if_present(self):
        if "warn_monthly" in self.data:
            assert_series_group(self.data["warn_monthly"], min_rows=3)


class TestMarketJson:
    def setup_method(self):
        self.data = load_json("market.json")

    def test_has_required_keys(self):
        for key in ["stock_indices", "stock_indexed", "market_employment_overlay"]:
            assert key in self.data

    def test_all_valid(self):
        for key in self.data:
            assert_series_group(self.data[key], min_rows=50)


class TestCorrelationJson:
    def setup_method(self):
        self.data = load_json("correlation.json")

    def test_has_required_keys(self):
        for key in ["market_vs_employment", "layoffs_vs_jolts", "nasdaq_vs_openings"]:
            assert key in self.data

    def test_all_valid(self):
        for key in self.data:
            assert_series_group(self.data[key], min_rows=10)


class TestAiJson:
    def setup_method(self):
        self.data = load_json("ai.json")

    def test_has_required_keys(self):
        expected = [
            "ai_job_share", "software_dev_postings", "it_investment",
            "semiconductor_production", "investment_vs_hiring",
            "nvda_vs_employment", "sector_ai_adoption",
        ]
        for key in expected:
            assert key in self.data, f"Missing key: {key}"

    def test_sector_adoption_structure(self):
        adoption = self.data["sector_ai_adoption"]
        assert len(adoption) >= 10
        assert "adoption_pct" in adoption[0]
        assert "sector" in adoption[0]


class TestEventStudyJson:
    def setup_method(self):
        self.data = load_json("event_study.json")

    def test_has_events(self):
        assert "events" in self.data
        assert len(self.data["events"]) >= 10

    def test_event_structure(self):
        event = self.data["events"][0]
        assert "id" in event
        assert "title" in event
        assert "date" in event
        assert "window" in event
        assert "summary" in event

    def test_summary_has_car_fields(self):
        summary = self.data["events"][0]["summary"]
        for key in ["sp500_car_10d", "nasdaq_car_10d", "nvda_car_10d"]:
            assert key in summary

    def test_summary_has_employment_context(self):
        summary = self.data["events"][0]["summary"]
        assert "info_employment_at_event" in summary

    def test_window_structure(self):
        window = self.data["events"][0]["window"]
        assert "labels" in window
        assert "data" in window
        assert len(window["data"]) >= 10
        assert "day" in window["data"][0]
